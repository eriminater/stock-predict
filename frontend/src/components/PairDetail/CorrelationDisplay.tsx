import { useEffect, useState } from 'react';
import { getCorrelation } from '../../services/api';
import type { Correlation } from '../../types';

interface Props {
  pairId: string;
  usTicker: string;
  jpName: string;
}

export default function CorrelationDisplay({ pairId, usTicker, jpName }: Props) {
  const [corr, setCorr] = useState<Correlation | null>(null);

  useEffect(() => {
    getCorrelation(pairId).then(setCorr).catch(() => {});
  }, [pairId]);

  const renderCard = (label: string, value: number) => {
    const abs = Math.abs(value);
    const color = abs >= 0.5 ? 'text-up' : abs >= 0.3 ? 'text-gold' : 'text-down';
    const bgColor = abs >= 0.5 ? 'bg-up-bg border-green-300' : abs >= 0.3 ? 'bg-yellow-50 border-yellow-300' : 'bg-down-bg border-red-300';
    const levelLabel = abs >= 0.5 ? '高い連動性' : abs >= 0.3 ? '中程度の連動性' : '低い連動性';

    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-center">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">{label}</div>
        <div className={`font-mono text-[24px] font-bold tracking-tight ${color}`}>
          {value.toFixed(2)}
        </div>
        <div className={`mt-2.5 inline-block border rounded px-3.5 py-0.5 text-[11.5px] font-semibold ${bgColor} ${color}`}>
          {levelLabel}
        </div>
      </div>
    );
  };

  if (!corr) return <div className="text-text-muted text-center py-8">読み込み中...</div>;

  return (
    <div className="border border-border rounded-xl p-5 mb-6">
      <div className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-[3px] h-3.5 bg-accent rounded" />
        相関係数（{usTicker} vs {jpName}）
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderCard('相関係数（30日）', corr.period_30)}
        {renderCard('相関係数（60日）', corr.period_60)}
        {renderCard('相関係数（90日）', corr.period_90)}
      </div>
    </div>
  );
}
