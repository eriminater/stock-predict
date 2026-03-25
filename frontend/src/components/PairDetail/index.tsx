import { useState, useEffect, useRef } from 'react';
import type { Pair, Prediction } from '../../types';
import { getPredictions } from '../../services/api';
import FormulaCards from './FormulaCards';
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

const calcIsPredictionMode = () => {
  const now = new Date();
  const hour = (now.getUTCHours() + 9) % 24;
  const min = now.getUTCMinutes();
  return hour >= 5 && (hour < 9 || (hour === 9 && min < 15));
};

export default function PairDetail({ pair, initializing, onInitializingDone }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isPredictionMode, setIsPredictionMode] = useState(calcIsPredictionMode);

  useEffect(() => {
    const timer = setInterval(() => setIsPredictionMode(calcIsPredictionMode()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState(30);
  const [stockDays, setStockDays] = useState(30);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 24; // 2分（5秒×24回）

  useEffect(() => {
    setLoadingData(true);
    setLoadError(false);
    setPredictions([]);
    retryCountRef.current = 0;

    const fetchWithRetry = () => {
      getPredictions(pair.id).then(data => {
        if (data.length > 0) {
          setPredictions(data);
          setLoadingData(false);
          onInitializingDone?.();
        } else if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          retryRef.current = setTimeout(fetchWithRetry, 5000);
        } else {
          setLoadingData(false);
          setLoadError(true);
          onInitializingDone?.();
        }
      }).catch(() => {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          retryRef.current = setTimeout(fetchWithRetry, 5000);
        } else {
          setLoadingData(false);
          setLoadError(true);
          onInitializingDone?.();
        }
      });
    };

    fetchWithRetry();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [pair.id]);

  const dayOptions = [10, 30, 60, 90];

  if (loadError) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-down text-4xl">⚠</div>
        <div className="text-text-secondary font-medium">データ取得に失敗しました</div>
        <div className="text-text-muted text-[12px] text-center max-w-sm">
          {pair.us_ticker} / {pair.jp_ticker} のデータを取得できませんでした。<br />
          ティッカーが正しいか確認し、設定画面から「最新データ取得」を試してください。
        </div>
      </div>
    );
  }

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
      <FormulaCards predictions={predictions} usTicker={pair.us_ticker} jpTicker={pair.jp_ticker} isPredictionMode={isPredictionMode} />


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
