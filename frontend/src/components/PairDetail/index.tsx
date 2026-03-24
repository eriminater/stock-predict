import { useState, useEffect, useRef } from 'react';
import type { Pair, Prediction } from '../../types';
import { getPredictions } from '../../services/api';
import FormulaCards from './FormulaCards';
import AdrPtsBar from '../AdrPtsBar';
import PredictionChart from './PredictionChart';
import RatioChart from './RatioChart';
import CorrelationDisplay from './CorrelationDisplay';
import StockChart from './StockChart';
import NewsList from './NewsList';
import DataTable from './DataTable';

interface Props {
  pair: Pair;
  initializing?: boolean;
  onInitializingDone?: () => void;
}

export default function PairDetail({ pair, initializing, onInitializingDone }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [days, setDays] = useState(30);
  const [stockDays, setStockDays] = useState(30);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoadingData(true);
    setPredictions([]);

    const fetchWithRetry = () => {
      getPredictions(pair.id).then(data => {
        if (data.length > 0) {
          setPredictions(data);
          setLoadingData(false);
          onInitializingDone?.();
        } else {
          retryRef.current = setTimeout(fetchWithRetry, 5000);
        }
      }).catch(() => {
        retryRef.current = setTimeout(fetchWithRetry, 5000);
      });
    };

    fetchWithRetry();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [pair.id]);

  const dayOptions = [10, 30, 60, 90];

  if (loadingData || initializing) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <div className="text-text-secondary font-medium">データ分析中...</div>
        <div className="text-text-muted text-[12px]">
          {pair.us_ticker} / {pair.jp_ticker} のデータを取得・計算しています
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <FormulaCards predictions={predictions} usTicker={pair.us_ticker} jpTicker={pair.jp_ticker} />

      <div className="border border-border rounded-xl px-5 py-3 mb-6">
        <AdrPtsBar
          pairId={pair.id}
          className="flex items-center gap-4 flex-wrap"
        />
      </div>

      <div className="border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <span className="w-[3px] h-3.5 bg-accent rounded" />
            全予測モデル vs 実績始値（過去{days}日）
          </div>
          <div className="flex gap-1.5">
            {dayOptions.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-0.5 text-[11px] border rounded cursor-pointer transition-all ${
                  days === d
                    ? 'border-accent bg-accent-light text-accent font-semibold'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                {d}日
              </button>
            ))}
          </div>
        </div>
        <PredictionChart pairId={pair.id} days={days} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold flex items-center gap-2">
          <span className="w-[3px] h-3.5 bg-accent rounded" />
          株価チャート・相関分析（過去{stockDays}日）
        </div>
        <div className="flex gap-1.5">
          {[10, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setStockDays(d)}
              className={`px-2.5 py-0.5 text-[11px] border rounded cursor-pointer transition-all ${
                stockDays === d
                  ? 'border-accent bg-accent-light text-accent font-semibold'
                  : 'border-border bg-surface text-text-secondary'
              }`}
            >
              {d}日
            </button>
          ))}
        </div>
      </div>

      <RatioChart
        usTicker={pair.us_ticker}
        jpTicker={pair.jp_ticker}
        usLabel={pair.us_ticker}
        jpLabel={pair.display_name_jp || pair.jp_ticker}
        days={stockDays}
      />

      <CorrelationDisplay pairId={pair.id} usTicker={pair.us_ticker} jpName={pair.display_name_jp || pair.jp_ticker} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <StockChart ticker={pair.us_ticker} label={pair.us_ticker} color="#0ea5e9" />
        <StockChart ticker={pair.jp_ticker} label={pair.display_name_jp || pair.jp_ticker} color="#1a56db" />
      </div>

      <NewsList tickers={[
        { ticker: pair.us_ticker, label: pair.us_ticker, color: '#0ea5e9' },
        { ticker: pair.jp_ticker, label: pair.display_name_jp || pair.jp_ticker, color: '#1a56db' },
        { ticker: pair.industry_ticker, label: pair.display_name_industry || pair.industry_ticker, color: '#10b981' },
      ]} />

      <DataTable pairId={pair.id} usTicker={pair.us_ticker} jpTicker={pair.jp_ticker} />
    </div>
  );
}
