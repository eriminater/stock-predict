import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Pair } from '../../types';
import { aiChat } from '../../services/api';

interface Props {
  pairs: Pair[];
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const PRESETS = [
  { label: '本日の予測', text: '本日の株価を予測してください' },
  { label: '連動性分析', text: '連動性を分析してください' },
  { label: 'ニュース影響', text: '最新ニュースから株価への影響を考察してください' },
  { label: '為替影響分析', text: '現在の為替水準は株価にどう影響しますか？' },
  { label: 'モデル精度分析', text: '直近30日の予測誤差の傾向を分析し、モデルの精度改善案を提案してください' },
];

export default function AIAnalyst({ pairs }: Props) {
  const [selectedPairId, setSelectedPairId] = useState(pairs[0]?.id || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || !selectedPairId) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setSending(true);
    try {
      const res = await aiChat(selectedPairId, msg);
      setMessages(prev => [...prev, { role: 'ai', text: res.response }]);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      const msg = detail.includes('クォータ') || detail.includes('quota') || detail.includes('429')
        ? 'APIのリクエスト上限に達しています。しばらく時間をおいてから再度お試しください。'
        : 'エラーが発生しました。もう一度お試しください。';
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    }
    setSending(false);
  };

  const selectedPair = pairs.find(p => p.id === selectedPairId);

  return (
    <div className="animate-fadeIn max-w-[800px] mx-auto">
      <div className="border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <span className="w-[3px] h-3.5 bg-accent rounded" />
            AIアナリスト
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pairs.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPairId(p.id)}
                className={`px-3 py-1 text-[12px] font-mono font-semibold border rounded-lg cursor-pointer transition-all ${
                  selectedPairId === p.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {p.us_ticker} / {p.jp_ticker}
              </button>
            ))}
            <span className="text-[10px] font-semibold bg-accent-light text-accent px-2 py-0.5 rounded-full uppercase ml-1">Gemini 2.5</span>
          </div>
        </div>

        {selectedPair && (
          <div className="bg-surface rounded-lg px-4 py-3 text-xs text-text-secondary mb-4">
            <b>自動コンテキスト:</b> {selectedPair.us_ticker} / {selectedPair.jp_ticker} の最新データ・予測・ニュースを含む
          </div>
        )}

        <div ref={historyRef} className="h-[340px] overflow-y-auto py-2 flex flex-col gap-3">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="bg-accent text-white rounded-[14px_14px_3px_14px] px-4 py-2.5 max-w-[75%] text-[13.5px] leading-relaxed">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5 items-start">
                <div className="w-[30px] h-[30px] bg-gradient-to-br from-accent to-accent2 rounded-full flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                </div>
                <div className="bg-surface border border-border rounded-[3px_14px_14px_14px] px-4 py-3 max-w-[80%] text-[13.5px] leading-relaxed">
                  <ReactMarkdown components={{
                    p:      ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                    ul:     ({children}) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                    ol:     ({children}) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                    li:     ({children}) => <li className="text-[13px]">{children}</li>,
                    h1:     ({children}) => <h1 className="text-base font-bold mb-1">{children}</h1>,
                    h2:     ({children}) => <h2 className="text-[14px] font-bold mb-1">{children}</h2>,
                    h3:     ({children}) => <h3 className="text-[13px] font-semibold mb-1">{children}</h3>,
                    code:   ({children}) => <code className="bg-gray-100 rounded px-1 text-[12px] font-mono">{children}</code>,
                  }}>{m.text}</ReactMarkdown>
                </div>
              </div>
            )
          ))}
          {sending && (
            <div className="flex gap-2.5 items-start">
              <div className="w-[30px] h-[30px] bg-gradient-to-br from-accent to-accent2 rounded-full flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
              </div>
              <div className="bg-surface border border-border rounded-[3px_14px_14px_14px] px-4 py-3 text-text-muted text-sm">
                <span className="animate-pulse-dot">考え中...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-3.5 flex-wrap">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => send(p.text)} className="px-3.5 py-1.5 border border-border rounded-full text-xs bg-surface cursor-pointer text-text-secondary hover:border-accent hover:text-accent hover:bg-accent-light transition-all">
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="質問を入力してください..."
          className="flex-1 px-4 py-2.5 text-sm border border-border2 rounded-xl outline-none focus:border-accent transition-colors"
        />
        <button onClick={() => send()} disabled={sending} className="px-5 py-2.5 bg-accent text-white border-none rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50">
          送信
        </button>
      </div>
    </div>
  );
}
