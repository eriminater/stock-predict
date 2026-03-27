import { useEffect, useState } from 'react';
import type { Pair, Prediction, PredictionStats, LivePrediction, AdrPts } from '../../types';
import { getPredictions, getPredictionHistory, getLivePrediction, getAdrPts } from '../../services/api';
import PredictionCard from './PredictionCard';

interface Props {
  pair: Pair;
  onNavigate?: () => void;
}

const getJST = () => {
  const now = new Date();
  return { hour: (now.getUTCHours() + 9) % 24, min: now.getUTCMinutes() };
};

const calcIsPredictionMode = () => {
  const { hour } = getJST();
  return hour >= 5 && hour < 9;
};

// 5:00〜5:20、6:00〜6:20、9:00〜9:20 JSTの間はポーリング対象
const isInPollingWindow = () => {
  const { hour, min } = getJST();
  if (hour === 5 && min < 20) return true;
  if (hour === 6 && min < 20) return true;
  if (hour === 9 && min < 20) return true;
  return false;
};

export default function PredictionHero({ pair, onNavigate }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<Record<string, PredictionStats>>({});
  const [live, setLive] = useState<LivePrediction | null>(null);
  const [adrPts, setAdrPts] = useState<AdrPts | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const [isPredictionMode, setIsPredictionMode] = useState(calcIsPredictionMode);

  // isPredictionMode を1分ごとに更新
  useEffect(() => {
    const timer = setInterval(() => setIsPredictionMode(calcIsPredictionMode()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getPredictions(pair.id).then(setPredictions).catch(() => {});
    getPredictionHistory(pair.id, 30).then(r => setStats(r.stats || {})).catch(() => {});
    getLivePrediction(pair.id).then(data => { setLive(data); setLiveUpdatedAt(new Date()); }).catch(() => {});
    getAdrPts(pair.id).then(setAdrPts).catch(() => {});
  }, [pair.id, pair.jp_ticker]);

  // 5:00〜5:20 または 9:00〜9:20 JSTの間、60秒ごとにデータをポーリングして画面更新
  useEffect(() => {
    const poll = setInterval(() => {
      if (!isInPollingWindow()) return;
      getPredictions(pair.id).then(setPredictions).catch(() => {});
      getAdrPts(pair.id).then(setAdrPts).catch(() => {});
    }, 60_000);
    return () => clearInterval(poll);
  }, [pair.id, pair.jp_ticker]);

  const handleRefreshLive = () => {
    setRefreshing(true);
    getLivePrediction(pair.id)
      .then(data => { setLive(data); setLiveUpdatedAt(new Date()); })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const getModel = (type: string) => predictions.find(p => p.model_type === type);
  const original = getModel('original');
  const volatility = getModel('volatility');
  const regression = getModel('regression');

  const origValue = original?.predicted_open ?? 0;
  const volValue = volatility?.predicted_open ?? 0;
  const regValue = regression?.predicted_open ?? 0;

  // 🔥 的中率（"25/30" → 25）が最高のモデル
  const parseHits = (hr: string | undefined) => hr ? parseInt(hr.split('/')[0], 10) : -1;
  const hitRates = {
    original:   parseHits(stats.original?.hit_rate),
    volatility: parseHits(stats.volatility?.hit_rate),
    regression: parseHits(stats.regression?.hit_rate),
  };
  const maxHits = Math.max(...Object.values(hitRates));
  const topHitRate = (key: string) => maxHits > 0 && hitRates[key as keyof typeof hitRates] === maxHits;

  const actualOpen = isPredictionMode
    ? null
    : (original?.actual_open ?? volatility?.actual_open ?? regression?.actual_open);
  const isWaiting = actualOpen === null || actualOpen === undefined;

  // 👑 当日の実際の始値に最も近かったモデル
  const todayErrors = actualOpen
    ? {
        original:   original   ? Math.abs(origValue - actualOpen) : Infinity,
        volatility: volatility ? Math.abs(volValue  - actualOpen) : Infinity,
        regression: regression ? Math.abs(regValue  - actualOpen) : Infinity,
      }
    : null;
  const minTodayErr = todayErrors ? Math.min(...Object.values(todayErrors)) : Infinity;
  const crowned = (key: string) =>
    todayErrors !== null && minTodayErr < Infinity &&
    todayErrors[key as keyof typeof todayErrors] === minTodayErr;

  return (
    <div
      onClick={onNavigate}
      className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-4 sm:p-7 mb-0 relative overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="absolute -top-10 -right-10 w-50 h-50 bg-radial from-accent/8 to-transparent pointer-events-none" />
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <span className="bg-accent text-white text-[11px] font-bold px-2 py-0.5 rounded font-mono">{pair.us_ticker}</span>
        <span className="bg-blue-50 text-accent border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded font-mono">{pair.jp_ticker}</span>
        <span className="text-[15px] font-semibold ml-1">
          {pair.display_name_us || pair.us_ticker} × {pair.display_name_jp || pair.jp_ticker}
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          {(pair.display_name_industry || pair.industry_ticker) && (
            <span className="bg-blue-50 border border-blue-200 text-text-secondary text-[11px] px-2.5 py-0.5 rounded">
              {pair.display_name_industry || pair.industry_ticker}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); handleRefreshLive(); }}
            disabled={refreshing}
            className="text-[10px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
          >
            {refreshing
              ? <span className="w-2 h-2 border border-text-muted border-t-transparent rounded-full animate-spin inline-block" />
              : <span className="text-[9px]">↺</span>
            }
            時間外取引値更新
            {liveUpdatedAt && (
              <span className="text-[9px] text-text-muted">
                ({liveUpdatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tokyo' })})
              </span>
            )}
          </button>
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PredictionCard
          label="オリジナル予測"
          dotColor="var(--color-accent)"
          value={origValue}
          liveValue={live?.original ?? null}
          stats={stats.original}
          crowned={!isPredictionMode && crowned('original')}
          topHitRate={topHitRate('original')}
        />
        <PredictionCard
          label="ボラティリティ予測"
          dotColor="#f59e0b"
          value={volValue}
          liveValue={live?.volatility ?? null}
          stats={stats.volatility}
          crowned={!isPredictionMode && crowned('volatility')}
          topHitRate={topHitRate('volatility')}
        />
        <PredictionCard
          label="回帰モデル予測"
          dotColor="#10b981"
          value={regValue}
          liveValue={live?.regression ?? null}
          stats={stats.regression}
          crowned={!isPredictionMode && crowned('regression')}
          topHitRate={topHitRate('regression')}
        />
        <PredictionCard
          label="当日始値（実績）"
          dotColor="var(--color-accent)"
          value={actualOpen ?? 0}
          isActual={!isWaiting}
          isPredictionMode={isPredictionMode && isWaiting}
          waitingMessage={isWaiting && !isPredictionMode ? '株価予想中...' : undefined}
          adrPts={adrPts}
        />
      </div>
    </div>
  );
}
