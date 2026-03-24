import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { pairResearch, suggestPairs } from '../../services/api';

interface PresetPair {
  us_ticker: string;
  jp_ticker: string;
  jp_name: string;
}

const PRESETS: PresetPair[] = [
  { us_ticker: 'SNDK', jp_ticker: '285A.T', jp_name: 'キオクシア' },
  { us_ticker: 'MU', jp_ticker: '8035.T', jp_name: '東京エレクトロン' },
  { us_ticker: 'NVDA', jp_ticker: '6857.T', jp_name: 'アドバンテスト' },
  { us_ticker: 'AMAT', jp_ticker: '6146.T', jp_name: 'ディスコ' },
  { us_ticker: 'ASML', jp_ticker: '4063.T', jp_name: '信越化学' },
  { us_ticker: 'AMD', jp_ticker: '6723.T', jp_name: 'ルネサス' },
  { us_ticker: 'AVGO', jp_ticker: '6981.T', jp_name: '村田製作所' },
  { us_ticker: 'KLAC', jp_ticker: '6920.T', jp_name: 'レーザーテック' },
  { us_ticker: 'TXN', jp_ticker: '6762.T', jp_name: 'TDK' },
  { us_ticker: 'TSM', jp_ticker: '8035.T', jp_name: '東京エレクトロン' },
  { us_ticker: 'INTC', jp_ticker: '6723.T', jp_name: 'ルネサス' },
  { us_ticker: 'QCOM', jp_ticker: '6758.T', jp_name: 'ソニーG' },
  { us_ticker: 'MRVL', jp_ticker: '6976.T', jp_name: '太陽誘電' },
  { us_ticker: 'LRCX', jp_ticker: '7735.T', jp_name: 'SCREEN HD' },
  { us_ticker: 'ON', jp_ticker: '6963.T', jp_name: 'ローム' },
  { us_ticker: 'MCHP', jp_ticker: '6594.T', jp_name: '日本電産' },
  { us_ticker: 'ADI', jp_ticker: '6861.T', jp_name: 'キーエンス' },
  { us_ticker: 'NXPI', jp_ticker: '6902.T', jp_name: 'デンソー' },
  { us_ticker: 'MSFT', jp_ticker: '6501.T', jp_name: '日立' },
  { us_ticker: 'AAPL', jp_ticker: '6981.T', jp_name: '村田製作所' },
];

interface Props {
  onRegisterPair: (us: string, jp: string, ind: string) => void;
}

interface PricePoint {
  date: string;
  close: number | null;
}

export default function PairResearch({ onRegisterPair }: Props) {
  const [presets, setPresets] = useState<PresetPair[]>(PRESETS);
  const [selected, setSelected] = useState<number>(0);
  const [customUs, setCustomUs] = useState('');
  const [customJp, setCustomJp] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState<{
    correlations: Record<string, number>;
    predictions: Record<string, number>;
    us_prices: PricePoint[];
    jp_prices: PricePoint[];
  } | null>(null);

  const handleAnalyze = async () => {
    const us = customUs || PRESETS[selected]?.us_ticker;
    const jp = customJp || PRESETS[selected]?.jp_ticker;
    if (!us || !jp) return;
    setLoading(true);
    try {
      const res = await pairResearch({ us_ticker: us, jp_ticker: jp });
      setResult(res);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const suggested = await suggestPairs();
      if (suggested.length > 0) {
        setPresets(suggested.map((s: { us_ticker: string; jp_ticker: string; jp_name: string }) => ({
          us_ticker: s.us_ticker,
          jp_ticker: s.jp_ticker,
          jp_name: s.jp_name,
        })));
        setSelected(0);
        setResult(null);
      }
    } catch { /* ignore */ }
    setAiLoading(false);
  };

  const usLabel = customUs || presets[selected]?.us_ticker || 'US';
  const jpLabel = customJp || presets[selected]?.jp_name || 'JP';

  const chartData = result ? {
    labels: [...result.us_prices].reverse().map(p => p.date?.slice(5) ?? ''),
    datasets: [
      {
        label: usLabel,
        data: [...result.us_prices].reverse().map(p => p.close),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: jpLabel,
        data: [...result.jp_prices].reverse().map(p => p.close),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: true, position: 'top' as const } },
    scales: {
      y: { type: 'linear' as const, position: 'left' as const, title: { display: true, text: `${usLabel} ($)` } },
      y1: { type: 'linear' as const, position: 'right' as const, title: { display: true, text: `${jpLabel} (¥)` }, grid: { drawOnChartArea: false } },
    },
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold flex items-center gap-2">
          <span className="w-[3px] h-3.5 bg-accent rounded" />
          ペア調査
        </div>
        <div className="flex gap-2.5 items-center">
          <input
            type="text"
            placeholder="US: NVDA"
            value={customUs}
            onChange={e => setCustomUs(e.target.value.toUpperCase())}
            className="px-3 py-1.5 text-[13px] border border-border rounded-lg font-mono w-28 outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="JP: 6857.T"
            value={customJp}
            onChange={e => setCustomJp(e.target.value)}
            className="px-3 py-1.5 text-[13px] border border-border rounded-lg font-mono w-28 outline-none focus:border-accent"
          />
          <button onClick={handleAnalyze} disabled={loading} className="px-4 py-1.5 bg-accent text-white border-none rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50">
            {loading ? '分析中...' : '分析開始'}
          </button>
          <button onClick={handleAiSuggest} disabled={loading || aiLoading} className="px-4 py-1.5 bg-surface text-text-secondary border border-border rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50">
            {aiLoading ? 'AI提案中...' : 'AIにペアを提案してもらう'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-6">
        {presets.map((p, i) => (
          <div
            key={i}
            onClick={() => { setSelected(i); setCustomUs(''); setCustomJp(''); setResult(null); }}
            className={`border rounded-xl px-3.5 py-3 cursor-pointer bg-surface transition-all ${
              selected === i ? 'border-2 border-accent bg-accent-light' : 'border-border hover:border-accent2'
            }`}
          >
            <div className={`text-[10px] font-semibold mb-1 ${selected === i ? 'text-accent' : 'text-text-muted'}`}>
              {selected === i ? 'SELECTED' : `PAIR #${i + 1}`}
            </div>
            <div className="font-bold text-sm">{p.us_ticker}</div>
            <div className="text-[11px] text-text-muted">↕ {p.jp_name} {p.jp_ticker.replace('.T', '')}</div>
          </div>
        ))}
      </div>

      {result && (
        <div className="border border-border rounded-xl p-5 mb-6">
          <div className="text-sm font-semibold mb-3">分析結果</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {Object.entries(result.correlations).map(([k, v]) => (
              <div key={k} className="bg-surface border border-border rounded-lg p-4 text-center">
                <div className="text-[10px] font-bold uppercase text-text-muted mb-2">{k.replace('period_', '')}日相関</div>
                <div className="font-mono text-2xl font-bold">{v.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {chartData && (
            <div className="bg-surface border border-border rounded-lg p-4 mb-4">
              <div className="text-[11px] font-bold uppercase text-text-muted mb-3">株価推移（30日）</div>
              <Line data={chartData} options={chartOptions} />
            </div>
          )}

          <button
            onClick={() => {
              onRegisterPair(customUs || presets[selected]?.us_ticker, customJp || presets[selected]?.jp_ticker, '');
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            このペアを登録
          </button>
        </div>
      )}
    </div>
  );
}
