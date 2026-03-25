import type { Prediction } from '../../types';

interface Props {
  predictions: Prediction[];
  usTicker: string;
  jpTicker: string;
}

/** "2026-03-18" → "3/18" */
function d(date: unknown): string {
  if (!date) return '';
  const m = String(date).match(/\d{4}-(\d{2})-(\d{2})/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : String(date);
}

/** Safe number formatter */
function n(v: unknown, decimals = -1): string {
  const num = Number(v);
  if (isNaN(num) || v === undefined || v === null) return '-';
  if (decimals >= 0) return num.toFixed(decimals);
  return num.toLocaleString();
}

/** Dim label span */
const Dim = ({ children }: { children: React.ReactNode }) => (
  <span className="text-text-muted">{children}</span>
);

export default function FormulaCards({ predictions, usTicker, jpTicker }: Props) {
  const original = predictions.find(p => p.model_type === 'original');
  const volatility = predictions.find(p => p.model_type === 'volatility');
  const regression = predictions.find(p => p.model_type === 'regression');

  const op = original?.parameters as Record<string, unknown> | undefined;
  const vp = volatility?.parameters as Record<string, unknown> | undefined;

  const actualOpen = original?.actual_open ?? volatility?.actual_open ?? regression?.actual_open;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">

      {/* Model 1: Original */}
      <FormulaCard color="#e91e8c" label="オリジナル予測式" prediction={original}
        body={op ? (
          <>
            <div>
              = (<Dim>{usTicker} {d(op.us_date_latest)}</Dim> ${n(op.us_close_latest)}
              &nbsp;/&nbsp;<Dim>{usTicker} {d(op.us_date_prev)}</Dim> ${n(op.us_close_prev)})
            </div>
            <div>
              &nbsp; × (<Dim>為替 {d(op.fx_date_latest)}</Dim> ¥{n(op.fx_latest)}
              &nbsp;/&nbsp;<Dim>為替 {d(op.fx_date_prev)}</Dim> ¥{n(op.fx_prev)})
            </div>
            <div>
              &nbsp; × <Dim>{jpTicker} {d(op.jp_date_latest)}</Dim> ¥{n(op.jp_close_latest)}
            </div>
          </>
        ) : null}
      />

      {/* Model 2: Volatility */}
      <FormulaCard color="#f59e0b" label="ボラティリティ予測式" prediction={volatility}
        body={vp ? (
          <>
            <div>
              = <Dim>{jpTicker} {d(vp.jp_date_latest)}</Dim> ¥{n(vp.jp_close_latest)}
            </div>
            <div>
              &nbsp; × (1 + (<Dim>{usTicker} {d(vp.us_date_latest)}</Dim> ${n(vp.us_close_latest)}
              &nbsp;/&nbsp;<Dim>{usTicker} {d(vp.us_date_prev)}</Dim> ${n(vp.us_close_prev)} − 1)
            </div>
            <div>
              &nbsp;&nbsp;&nbsp; × <Dim>感応度</Dim> {n(vp.sensitivity, 4)}
              {vp.jp_std && vp.us_std ? (
                <Dim> （JP σ={n(vp.jp_std, 4)} / US σ={n(vp.us_std, 4)}）</Dim>
              ) : null}
            </div>
            <div>
              &nbsp;&nbsp;&nbsp; + (<Dim>為替 {d(vp.fx_date_latest)}</Dim> ¥{n(vp.fx_latest)}
              &nbsp;/&nbsp;<Dim>為替 {d(vp.fx_date_prev)}</Dim> ¥{n(vp.fx_prev)} − 1))
            </div>
          </>
        ) : null}
      />

      {/* Model 3: Regression */}
      <FormulaCard color="#10b981" label="回帰モデル予測式" prediction={regression}
        body={regression?.parameters ? (() => {
          const rp = regression.parameters as Record<string, number>;
          return (
            <>
              <div>= {jpTicker} × (1 + Gap_pred)</div>
              <div>Gap = α + β1×log({usTicker}) + β2×log(FX) + β3×log(業界)</div>
              <div className="text-text-muted text-[10.5px] mt-1.5">
                β1={rp.beta1} β2={rp.beta2} β3={rp.beta3} R²={rp.r_squared}
              </div>
            </>
          );
        })() : null}
      />

      {/* 当日始値（実績）*/}
      <div className="border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-accent" />
          当日始値（実績）
        </div>
        <div className="font-mono text-[11.5px] leading-relaxed text-text-secondary flex-1">
          {actualOpen != null ? (
            <span>本日の始値が確定しました</span>
          ) : (
            <span className="text-text-muted">市場開始後に表示されます</span>
          )}
        </div>
        <div className="font-mono text-xl font-bold border-t border-blue-200 mt-auto pt-2 text-accent">
          {actualOpen != null ? `¥${Math.round(actualOpen).toLocaleString()}` : '-'}
        </div>
      </div>

    </div>
  );
}

function FormulaCard({ color, label, prediction, body }: {
  color: string;
  label: string;
  prediction?: Prediction;
  body: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: color }} />
        {label}
      </div>
      <div className="font-mono text-[11.5px] leading-relaxed text-text-secondary flex-1">
        {body || <span className="text-text-muted">データ読み込み中...</span>}
      </div>
      <div className="font-mono text-xl font-medium border-t border-border mt-auto pt-2" style={{ color }}>
        ¥{prediction?.predicted_open?.toLocaleString() ?? '-'}
      </div>
    </div>
  );
}
