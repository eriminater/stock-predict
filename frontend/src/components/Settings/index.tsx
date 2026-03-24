import { useState } from 'react';
import type { Pair } from '../../types';
import { createPair, deletePair, fetchAllData, initializePair, suggestIndustry, setPreferredModel, validateTicker } from '../../services/api';

export type QuotaData = {
  calls_today: number;
  errors_429_today: number;
  estimated_remaining: number;
  preferred_model: string;
  last_model: string | null;
  last_call_at: string | null;
  limits: Record<string, number>;
};

interface Props {
  pairs: Pair[];
  onPairsChange: () => void;
  onPairInitializing?: (pairId: string) => void;
  onInitializingDone?: () => void;
  quota: QuotaData | null;
  quotaLoading: boolean;
  quotaError: boolean;
  onReloadQuota: () => void;
}

const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash-lite', label: '2.5 Flash Lite', rpd: 1000, note: '推奨' },
  { id: 'gemini-2.5-flash',      label: '2.5 Flash',      rpd: 250,  note: 'バランス' },
];

export default function Settings({ pairs, onPairsChange, onPairInitializing, onInitializingDone, quota, quotaLoading, quotaError, onReloadQuota }: Props) {
  const [usTicker, setUsTicker] = useState('');
  const [jpTicker, setJpTicker] = useState('');
  const [indTicker, setIndTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [tickerErrors, setTickerErrors] = useState<{ us: string; jp: string; ind: string }>({ us: '', jp: '', ind: '' });
  const [fetchStatus, setFetchStatus] = useState('');
  const [toast, setToast] = useState('');
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([]);

  const handleModelChange = async (modelId: string) => {
    try {
      await setPreferredModel(modelId);
      onReloadQuota();
    } catch { /* ignore */ }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  const validateField = async (field: 'us' | 'jp' | 'ind', ticker: string) => {
    if (!ticker) return;
    setValidating(true);
    try {
      const valid = await validateTicker(ticker);
      setTickerErrors(prev => ({ ...prev, [field]: valid ? '' : `"${ticker}" は無効なティッカーです` }));
    } catch {
      setTickerErrors(prev => ({ ...prev, [field]: '検証できませんでした' }));
    }
    setValidating(false);
  };

  const handleAiIndustry = async () => {
    if (!usTicker || !jpTicker) return;
    try {
      const res = await suggestIndustry(usTicker, jpTicker);
      setSuggestions(res);
    } catch {
      setSuggestions([]);
    }
  };

  const handleRegister = async () => {
    if (!usTicker || !jpTicker || !indTicker) return;
    // race condition対策: バリデーションが未完了なら直前に再検証
    setLoading(true);
    setValidating(true);
    try {
      const [usValid, jpValid, indValid] = await Promise.all([
        validateTicker(usTicker),
        validateTicker(jpTicker),
        validateTicker(indTicker),
      ]);
      const errs = {
        us: usValid ? '' : `"${usTicker}" は無効なティッカーです`,
        jp: jpValid ? '' : `"${jpTicker}" は無効なティッカーです`,
        ind: indValid ? '' : `"${indTicker}" は無効なティッカーです`,
      };
      setTickerErrors(errs);
      if (!usValid || !jpValid || !indValid) {
        setLoading(false);
        setValidating(false);
        return;
      }
    } catch {
      // 検証エラーは無視して続行
    }
    setValidating(false);
    try {
      const newPair = await createPair({
        us_ticker: usTicker.toUpperCase(),
        jp_ticker: jpTicker,
        industry_ticker: indTicker.toUpperCase(),
      });
      setUsTicker('');
      setJpTicker('');
      setIndTicker('');
      setSuggestions([]);
      onPairsChange();
      onPairInitializing?.(newPair.id);
      showToast('データ取得・分析中... (数分かかります)');
      initializePair(newPair.id).then(res => {
        onInitializingDone?.();
        if (res.fetch_errors?.length > 0) {
          showToast(`完了（一部エラー: ${res.fetch_errors.join(', ')}）`);
        } else {
          showToast('データ取得・予測計算が完了しました');
        }
      }).catch(() => {
        onInitializingDone?.();
        showToast('エラーが発生しました。「最新データ取得」ボタンをお試しください');
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'エラーが発生しました';
      showToast(msg);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このペアを削除しますか？')) return;
    await deletePair(id);
    showToast('ペアを削除しました');
    onPairsChange();
  };

  const handleFetch = async () => {
    setFetchStatus('取得中...');
    try {
      const res = await fetchAllData();
      setFetchStatus(`✓ ${res.fetched_at} 取得完了`);
      showToast('データ取得が完了しました');
    } catch {
      setFetchStatus('✕ 取得失敗');
    }
  };

  const isMaxPairs = pairs.length >= 10;

  return (
    <div className="animate-fadeIn">
      {/* Registered pairs */}
      {pairs.length > 0 && (
        <div className="mb-8">
          <div className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-4 pb-2.5 border-b border-border">
            登録済みペア（{pairs.length}/10）
          </div>
          <div className="flex flex-wrap gap-2">
            {pairs.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-accent-light text-accent border border-blue-200 rounded-full px-3 py-1 text-xs font-semibold font-mono">
                {p.us_ticker} ↔ {p.jp_ticker}
                <button onClick={() => handleDelete(p.id)} className="text-accent hover:text-down cursor-pointer text-sm leading-none ml-1 bg-transparent border-none">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pair add form */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[13px] font-bold text-text-muted uppercase tracking-wider mb-4 pb-2.5 border-b border-border">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5 7l2 2 4-4" /></svg>
          ペア追加
        </div>

        {isMaxPairs && (
          <div className="bg-down-bg border border-red-300 rounded-lg px-4 py-3 text-sm text-down font-medium mb-4">
            登録上限（10ペア）に達しています。既存ペアを削除してから追加してください
          </div>
        )}

        {/* Single-row: inputs + AI button + register button */}
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-sky-700">US アメリカ株</span>
            </label>
            <input
              type="text"
              value={usTicker}
              onChange={e => { setUsTicker(e.target.value.toUpperCase()); setTickerErrors(prev => ({ ...prev, us: '' })); }}
              onBlur={() => validateField('us', usTicker)}
              placeholder="NVDA"
              disabled={isMaxPairs}
              className={`w-full px-3 py-2 text-[13px] border rounded-lg font-mono bg-surface outline-none focus:bg-white uppercase disabled:opacity-50 ${tickerErrors.us ? 'border-red-400 focus:border-red-400' : 'border-border focus:border-accent'}`}
            />
            {tickerErrors.us && <div className="text-[10px] text-down mt-1">{tickerErrors.us}</div>}
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="bg-pink-50 border border-pink-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-pink-700">JP 日本株</span>
            </label>
            <input
              type="text"
              value={jpTicker}
              onChange={e => { setJpTicker(e.target.value); setTickerErrors(prev => ({ ...prev, jp: '' })); }}
              onBlur={() => validateField('jp', jpTicker)}
              placeholder="6857.T"
              disabled={isMaxPairs}
              className={`w-full px-3 py-2 text-[13px] border rounded-lg font-mono bg-surface outline-none focus:bg-white disabled:opacity-50 ${tickerErrors.jp ? 'border-red-400 focus:border-red-400' : 'border-border focus:border-accent'}`}
            />
            {tickerErrors.jp && <div className="text-[10px] text-down mt-1">{tickerErrors.jp}</div>}
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="bg-green-50 border border-green-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-green-700">業界株・指数</span>
            </label>
            <input
              type="text"
              value={indTicker}
              onChange={e => { setIndTicker(e.target.value.toUpperCase()); setTickerErrors(prev => ({ ...prev, ind: '' })); }}
              onBlur={() => validateField('ind', indTicker)}
              placeholder="^SOX"
              disabled={isMaxPairs}
              className={`w-full px-3 py-2 text-[13px] border rounded-lg font-mono bg-surface outline-none focus:bg-white uppercase disabled:opacity-50 ${tickerErrors.ind ? 'border-red-400 focus:border-red-400' : 'border-border focus:border-accent'}`}
            />
            {tickerErrors.ind && <div className="text-[10px] text-down mt-1">{tickerErrors.ind}</div>}
            <div className="text-[10px] text-text-muted font-mono mt-1">
              例: ^SOX（半導体）^IXIC（NASDAQ）^GSPC（S&P500）XLK（技術）
            </div>
            {suggestions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className="text-[10px] text-text-muted">AI提案:</span>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setIndTicker(s.ticker)} className="px-2.5 py-1 bg-accent-light text-accent border border-blue-200 rounded-full text-[11px] font-semibold font-mono cursor-pointer">
                    {s.ticker}（{s.name}）
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-start">
            <div className="h-[22px]" />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAiIndustry}
                disabled={isMaxPairs || !usTicker || !jpTicker}
                className="px-3 py-2 bg-surface text-text-secondary border border-border rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 hover:border-accent hover:text-accent transition-colors"
              >
                AI推論
              </button>
              <button
                onClick={handleRegister}
                disabled={loading || validating || isMaxPairs || !usTicker || !jpTicker || !indTicker || !!tickerErrors.us || !!tickerErrors.jp || !!tickerErrors.ind}
                className="flex items-center justify-center bg-accent text-white border-none rounded-lg px-8 py-2 text-sm font-medium cursor-pointer hover:bg-blue-700 disabled:opacity-50 transition-all whitespace-nowrap min-w-[90px]"
              >
                {loading ? '登録中...' : '登録'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Data refresh */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[13px] font-bold text-text-muted uppercase tracking-wider mb-4 pb-2.5 border-b border-border">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 8a7 7 0 1 0 1.5-4.3" /><polyline points="1 3 1 8 6 8" /></svg>
          データ取得
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl px-7 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-[15px] font-semibold mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-up animate-pulse-dot" />
              データ接続: 正常
            </h3>
            <p className="text-[12.5px] text-text-secondary">次回自動取得: 米国市場終値確定後（04:59〜05:59 JST）</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-text-muted">通常は自動更新されます</span>
              <button onClick={handleFetch} className="flex items-center gap-1.5 bg-accent text-white border-none rounded-lg px-5 py-2 text-sm font-medium cursor-pointer">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 8a7 7 0 1 0 1.5-4.3" /><polyline points="1 3 1 8 6 8" /></svg>
                最新データ取得
              </button>
            </div>
            {fetchStatus && <div className="text-[11px] text-text-muted font-mono">{fetchStatus}</div>}
          </div>
        </div>
      </div>

      {/* AI Quota Status */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2.5 border-b border-border">
          <div className="flex items-center gap-2 text-[13px] font-bold text-text-muted uppercase tracking-wider">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
            AI利用状況（Gemini API）
          </div>
          <button onClick={onReloadQuota} className="text-[11px] text-accent border border-blue-200 bg-accent-light rounded px-2 py-0.5 cursor-pointer">
            更新
          </button>
        </div>

        {/* Model selector */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-text-secondary mb-2">使用モデル</div>
          <div className="flex gap-2 flex-wrap">
            {MODEL_OPTIONS.map(m => (
              <button
                key={m.id}
                onClick={() => handleModelChange(m.id)}
                className={`px-3.5 py-2 rounded-lg border text-[12px] font-medium cursor-pointer transition-all ${
                  quota?.preferred_model === m.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                <div>{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${quota?.preferred_model === m.id ? 'text-blue-100' : 'text-text-muted'}`}>
                  {m.rpd.toLocaleString()}回/日・{m.note}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          {quotaLoading ? (
            <div className="text-[12px] text-text-muted">読み込み中...</div>
          ) : quotaError ? (
            <div className="text-[12px] text-down">取得に失敗しました。バックエンドが起動しているか確認してください。</div>
          ) : quota ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted mb-1">本日の呼び出し回数</div>
                <div className="font-mono text-[20px] font-bold text-text-primary">{quota.calls_today}</div>
                <div className="text-[10px] text-text-muted">上限: {(quota.limits[quota.preferred_model] ?? '—').toLocaleString()}回/日</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted mb-1">推定残り回数</div>
                <div className={`font-mono text-[20px] font-bold ${quota.estimated_remaining > 200 ? 'text-up' : quota.estimated_remaining > 50 ? 'text-gold' : 'text-down'}`}>
                  {quota.estimated_remaining}
                </div>
                <div className="text-[10px] text-text-muted">選択モデル基準</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted mb-1">クォータエラー</div>
                <div className={`font-mono text-[20px] font-bold ${quota.errors_429_today === 0 ? 'text-up' : 'text-down'}`}>
                  {quota.errors_429_today}
                </div>
                <div className="text-[10px] text-text-muted">429エラー（本日）</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted mb-1">最後に使用したモデル</div>
                <div className="font-mono text-[11px] font-semibold text-text-secondary mt-1">{quota.last_model ?? '—'}</div>
                <div className="text-[10px] text-text-muted mt-0.5">{quota.last_call_at ? quota.last_call_at.slice(0, 16).replace('T', ' ') : '—'}</div>
              </div>
            </div>
          ) : null}
          <div className="mt-3 pt-3 border-t border-border text-[10.5px] text-text-muted leading-relaxed">
            ※ サーバー再起動でリセットされます。制限は毎日 17:00 JST にリセット（Gemini API 基準）。
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-7 right-7 bg-gray-900 text-white rounded-xl px-5 py-3 text-[13px] font-medium z-50 flex items-center gap-2 animate-fadeIn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 8 6 12 14 4" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
}
