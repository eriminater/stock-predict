import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import type { Plugin } from 'chart.js';
import { getPredictionHistory } from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const ctx = chart.ctx;
    const x = active[0].element.x;
    const { top, bottom } = chart.scales.y;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

interface Props {
  pairId: string;
  days: number;
}

export default function PredictionChart({ pairId, days }: Props) {
  const [chartData, setChartData] = useState<{
    labels: string[];
    original: (number | null)[];
    volatility: (number | null)[];
    regression: (number | null)[];
    actual: (number | null)[];
  }>({ labels: [], original: [], volatility: [], regression: [], actual: [] });

  useEffect(() => {
    getPredictionHistory(pairId, days).then(res => {
      const preds = res.predictions as Array<Record<string, unknown>>;
      const dates = [...new Set(preds.map(p => p.target_date as string))].sort();
      const orig: (number | null)[] = [];
      const vol: (number | null)[] = [];
      const reg: (number | null)[] = [];
      const act: (number | null)[] = [];
      for (const d of dates) {
        const dayPreds = preds.filter(p => p.target_date === d);
        const o = dayPreds.find(p => p.model_type === 'original')?.predicted_open as number | undefined;
        const v = dayPreds.find(p => p.model_type === 'volatility')?.predicted_open as number | undefined;
        const r = dayPreds.find(p => p.model_type === 'regression')?.predicted_open as number | undefined;
        const a = dayPreds[0]?.actual_open as number | null | undefined;
        orig.push(o ?? null);
        vol.push(v ?? null);
        reg.push(r ?? null);
        act.push(a ?? null);
      }
      setChartData({ labels: dates, original: orig, volatility: vol, regression: reg, actual: act });
    }).catch(() => {});
  }, [pairId, days]);

  const data = {
    labels: chartData.labels.map(d => {
      const m = d.match(/\d{4}-(\d{2})-(\d{2})/);
      return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
    }),
    datasets: [
      {
        label: 'オリジナル',
        data: chartData.original,
        borderColor: '#e91e8c',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        tension: 0.35,
        spanGaps: true,
      },
      {
        label: 'ボラティリティ',
        data: chartData.volatility,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 0,
        tension: 0.35,
        spanGaps: true,
      },
      {
        label: '回帰モデル',
        data: chartData.regression,
        borderColor: '#10b981',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0.35,
        spanGaps: true,
      },
      {
        label: '実績始値',
        data: chartData.actual,
        borderColor: '#1a56db',
        borderWidth: 4,
        borderDash: [],
        pointRadius: 0,
        tension: 0.2,
        spanGaps: true,
      },
    ],
  };

  return (
    <div className="h-[260px]">
      <Line
        data={data}
        plugins={[crosshairPlugin]}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { display: true, labels: { font: { size: 11 }, boxWidth: 20 } },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(255,255,255,0.97)',
              titleColor: '#374151',
              bodyColor: '#374151',
              borderColor: '#e5e7eb',
              borderWidth: 1,
              padding: 10,
              titleFont: { size: 11, weight: 'bold' },
              bodyFont: { size: 10.5 },
              callbacks: {
                label: item => {
                  if (item.parsed.y == null) return '';
                  return `${item.dataset.label}: ¥${Math.round(item.parsed.y).toLocaleString()}`;
                },
              },
            },
          },
          scales: {
            x: { grid: { color: '#f0f2f6' }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
            y: { grid: { color: '#f0f2f6' }, ticks: { font: { size: 10 } } },
          },
        }}
      />
    </div>
  );
}
