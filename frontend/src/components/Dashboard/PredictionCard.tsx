import type { PredictionStats, AdrPts } from '../../types';

interface Props {
  label: string;
  dotColor: string;
  value: number;
  liveValue?: number | null;
  extraInfo?: string;
  stats?: PredictionStats;
  isActual?: boolean;
  isPredictionMode?: boolean;
  waitingMessage?: string;
  adrPts?: AdrPts | null;
  crowned?: boolean;
  topHitRate?: boolean;
}

export default function PredictionCard({ label, dotColor, value, liveValue, extraInfo, stats, isActual, isPredictionMode, waitingMessage, adrPts, crowned, topHitRate }: Props) {
  const adr = adrPts?.adr;
  const pts = adrPts?.pts;
  const changePct = adr?.change_pct;

  const bgClass = isPredictionMode
    ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50'
    : isActual
      ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50'
      : 'border-border';

  return (
    <div className={`bg-white border rounded-xl p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-w-0 ${bgClass}`}>
      <div className="flex items-center gap-1 text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="truncate">{label}</span>
        {crowned && <span className="ml-auto text-[12px] leading-none">👑</span>}
      </div>

      {!isPredictionMode && waitingMessage ? (
        <div className="py-1">
          <div className="flex items-center gap-1.5 text-accent mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot shrink-0" />
            <span className="text-[11px] font-medium">{waitingMessage}</span>
          </div>
          {adrPts && (adr?.price || pts?.price) && (
            <AdrPtsBlock adr={adr} pts={pts} changePct={changePct} />
          )}
        </div>
      ) : (
        <>
          {isPredictionMode ? (
            <div className="flex items-center gap-2 text-orange-500 py-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse-dot shrink-0" />
              <span className="text-[18px] font-bold">始値予想中</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <div className="flex flex-col justify-center min-w-0">
                <div className={`font-mono tracking-tight truncate ${isActual ? 'text-[22px] sm:text-[30px] font-bold text-accent' : 'text-[18px] font-medium'}`}>
                  {`¥${Math.round(value).toLocaleString()}`}
                </div>
                {liveValue != null && (
                  <div className="text-[9.5px] text-text-muted font-mono truncate">
                    時間外最新: ¥{Math.round(liveValue).toLocaleString()}
                  </div>
                )}
              </div>
              {!isActual && value > 0 && (
                <div className="hidden sm:flex flex-col items-end shrink-0">
                  {[1, 2, 3].map(pct => (
                    <div key={pct} className="flex items-center gap-1">
                      <span className="text-[8.5px] text-text-muted">-{pct}%</span>
                      <span className="text-[10px] font-mono text-text-secondary">¥{Math.round(value * (1 - pct / 100)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {adrPts && (adr?.price || pts?.price) && (
            <AdrPtsBlock adr={adr} pts={pts} changePct={changePct} />
          )}
          {extraInfo && (
            <div className="text-[9.5px] text-text-muted font-mono truncate mb-1">{extraInfo}</div>
          )}
          {stats && (
            <div className="border-t border-border pt-2 mt-1.5 grid grid-cols-3 gap-1">
              <div>
                <div className="text-[8.5px] text-text-muted uppercase font-semibold leading-tight">平均誤差</div>
                <div className="font-mono text-[10.5px] font-medium text-text-secondary">
                  {stats.avg_error !== null ? `${stats.avg_error}%` : '-'}
                </div>
              </div>
              <div>
                <div className="text-[8.5px] text-text-muted uppercase font-semibold leading-tight">的中率</div>
                <div className="font-mono text-[10.5px] font-medium text-text-secondary flex items-center gap-0.5">
                  {stats.hit_rate}{topHitRate && <span className="text-[11px] leading-none">🔥</span>}
                </div>
              </div>
              <div>
                <div className="text-[8.5px] text-text-muted uppercase font-semibold leading-tight">最大誤差</div>
                <div className="font-mono text-[10.5px] font-medium text-text-secondary">
                  {stats.max_error !== null ? `${stats.max_error}%` : '-'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatPtsTime(raw: string): string {
  // kabutan format: "19:15　03/23" → "03/23 19:15"
  const parts = raw.trim().split(/[\s\u3000]+/);
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return raw;
}

function AdrPtsBlock({ adr, pts, changePct }: {
  adr: AdrPts['adr'] | undefined;
  pts: AdrPts['pts'] | undefined;
  changePct: number | null | undefined;
}) {
  return (
    <div className="border-t border-border pt-2 mt-1.5 grid grid-cols-2 gap-1">
      {adr?.price != null && (
        <div>
          <div className="text-[8.5px] text-text-muted uppercase font-semibold leading-tight">ADR</div>
          <div className="font-mono text-[10.5px] font-medium text-text-secondary">
            ${adr.price.toFixed(2)}
            {changePct != null && (
              <span> ({changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%)</span>
            )}
          </div>
        </div>
      )}
      {pts?.price != null && (
        <div>
          <div className="text-[8.5px] text-text-muted uppercase font-semibold leading-tight">PTS</div>
          <div className="font-mono text-[10.5px] font-medium text-text-secondary">
            ¥{pts.price.toLocaleString()}
            {pts.time && <span className="text-text-muted"> {formatPtsTime(pts.time)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
