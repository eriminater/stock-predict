import { useEffect, useState } from 'react';
import { getPredictionHistory, getPrices } from '../../services/api';

interface Props {
  pairId: string;
  usTicker: string;
  jpTicker: string;
}

interface Row {
  date: string;
  us_close: number;
  jp_close: number;
  fx: number;
  pred_orig: number;
  pred_vol: number;
  pred_reg: number;
  actual: number | null;
  err_orig: string;
  err_vol: string;
  err_reg: string;
}

export default function DataTable({ pairId, usTicker, jpTicker }: Props) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    Promise.all([
      getPredictionHistory(pairId, 30),
      getPrices(usTicker, 30),
      getPrices(jpTicker, 30),
      getPrices('USDJPY=X', 30),
    ]).then(([predRes, usPrices, jpPrices, fxPrices]) => {
      const predictions = predRes.predictions;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preds = predictions as any[];
      const dates = [...new Set(preds.map((p: any) => p.target_date as string))].sort().reverse().slice(0, 30) as string[];

      const usMap: Record<string, number> = Object.fromEntries(usPrices.map((p: any) => [p.date, p.close]));
      const jpMap: Record<string, number> = Object.fromEntries(jpPrices.map((p: any) => [p.date, p.close]));
      const fxMap: Record<string, number> = Object.fromEntries(fxPrices.map((p: any) => [p.date, p.close]));

      const built: Row[] = dates.map((d: string) => {
        const dayPreds = preds.filter((p: any) => p.target_date === d);
        const orig = dayPreds.find((p: any) => p.model_type === 'original');
        const vol = dayPreds.find((p: any) => p.model_type === 'volatility');
        const reg = dayPreds.find((p: any) => p.model_type === 'regression');

        return {
          date: d,
          us_close: usMap[d] ?? 0,
          jp_close: jpMap[d] ?? 0,
          fx: fxMap[d] ?? 0,
          pred_orig: orig?.predicted_open ?? 0,
          pred_vol: vol?.predicted_open ?? 0,
          pred_reg: reg?.predicted_open ?? 0,
          actual: orig?.actual_open ?? null,
          err_orig: orig?.error_pct != null ? `${Number(orig.error_pct) > 0 ? '+' : ''}${Number(orig.error_pct).toFixed(2)}%` : '-',
          err_vol: vol?.error_pct != null ? `${Number(vol.error_pct) > 0 ? '+' : ''}${Number(vol.error_pct).toFixed(2)}%` : '-',
          err_reg: reg?.error_pct != null ? `${Number(reg.error_pct) > 0 ? '+' : ''}${Number(reg.error_pct).toFixed(2)}%` : '-',
        };
      });
      setRows(built);
    }).catch(() => {});
  }, [pairId, usTicker, jpTicker]);

  const errClass = (s: string) => {
    if (s.startsWith('+')) return 'text-up font-medium';
    if (s.startsWith('-')) return 'text-down font-medium';
    return '';
  };

  return (
    <div className="border border-border rounded-xl p-5 mb-6">
      <div className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-[3px] h-3.5 bg-accent rounded" />
        直近30日データ
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {['日付', `${usTicker}終値($)`, `${jpTicker}終値(¥)`, '為替(¥/$)', '予測①(¥)', '予測②(¥)', '予測③(¥)', '実績始値(¥)', '誤差①(%)', '誤差②(%)', '誤差③(%)'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-surface border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.date} className="hover:bg-surface">
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.date}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.us_close}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.jp_close.toLocaleString()}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.fx}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.pred_orig.toLocaleString()}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.pred_vol.toLocaleString()}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.pred_reg.toLocaleString()}</td>
                <td className="px-3 py-2.5 border-b border-border font-mono text-text-secondary">{r.actual?.toLocaleString() ?? '-'}</td>
                <td className={`px-3 py-2.5 border-b border-border font-mono ${errClass(r.err_orig)}`}>{r.err_orig}</td>
                <td className={`px-3 py-2.5 border-b border-border font-mono ${errClass(r.err_vol)}`}>{r.err_vol}</td>
                <td className={`px-3 py-2.5 border-b border-border font-mono ${errClass(r.err_reg)}`}>{r.err_reg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
