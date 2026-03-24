import { useEffect, useState } from 'react';
import type { AdrPts } from '../types';
import { getAdrPts } from '../services/api';

interface Props {
  pairId: string;
  className?: string;
}

export default function AdrPtsBar({ pairId, className }: Props) {
  const [data, setData] = useState<AdrPts | null>(null);

  useEffect(() => {
    getAdrPts(pairId).then(setData).catch(() => {});
  }, [pairId]);

  if (!data) return null;

  const { adr, pts } = data;
  const hasAdr = adr.price != null;
  const hasPts = pts.price != null;
  if (!hasAdr && !hasPts) return null;

  const changePct = adr.change_pct;
  const changeColor = changePct == null ? 'text-text-muted'
    : changePct > 0 ? 'text-up'
    : changePct < 0 ? 'text-down'
    : 'text-text-secondary';
  const changeSign = changePct != null && changePct > 0 ? '+' : '';

  return (
    <div className={className ?? 'flex items-center gap-4 mt-3 pt-3 border-t border-blue-200/60 flex-wrap'}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">参考値</span>

      {hasAdr && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
            ADR
          </span>
          <span className="font-mono text-[13px] font-semibold text-text-primary">
            ${adr.price!.toFixed(2)}
          </span>
          {changePct != null && (
            <span className={`text-[11px] font-semibold font-mono ${changeColor}`}>
              {changeSign}{changePct.toFixed(2)}%
            </span>
          )}
          {adr.date && (
            <span className="text-[10px] text-text-muted">{adr.date}</span>
          )}
        </div>
      )}

      {hasAdr && hasPts && (
        <span className="text-border text-[11px]">|</span>
      )}

      {hasPts && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded font-mono">
            PTS
          </span>
          <span className="font-mono text-[13px] font-semibold text-text-primary">
            ¥{pts.price!.toLocaleString()}
          </span>
          {pts.time && (
            <span className="text-[10px] text-text-muted">{pts.time}</span>
          )}
        </div>
      )}
    </div>
  );
}
