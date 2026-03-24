import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import type { Plugin } from 'chart.js';
import { getPrices } from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

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
  usTicker: string;
  jpTicker: string;
  usLabel: string;
  jpLabel: string;
  days: number;
}

export default function RatioChart({ usTicker, jpTicker, usLabel, jpLabel, days }: Props) {
  const [chartPoints, setChartPoints] = useState<{ label: string; ratio: number }[]>([]);

  useEffect(() => {
    Promise.all([
      getPrices(usTicker, days + 5),
      getPrices(jpTicker, days + 5),
    ]).then(([usRaw, jpRaw]) => {
      const usData = [...usRaw].reverse();
      const jpData = [...jpRaw].reverse();

      const usMap = new Map(usData.map(p => [p.date, p.close]));
      const jpMap = new Map(jpData.map(p => [p.date, p.close]));
      const common = [...usMap.keys()].filter(d => jpMap.has(d)).sort().slice(-days);

      if (common.length < 2) return;

      const points = common.map(date => {
        const d = new Date(date);
        return {
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          ratio: jpMap.get(date)! / usMap.get(date)!,
        };
      });

      setChartPoints(points);
    }).catch(() => {});
  }, [usTicker, jpTicker, days]);

  const data = {
    labels: chartPoints.map(p => p.label),
    datasets: [
      {
        label: `${jpLabel} / ${usLabel}`,
        data: chartPoints.map(p => p.ratio),
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf622',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  return (
    <div className="border border-border rounded-xl p-5 mb-5">
      <div className="text-sm font-semibold mb-1 flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded" style={{ background: '#8b5cf6' }} />
        日本株 / 米国株 相対パフォーマンス比
      </div>
      <div className="text-[10.5px] text-text-muted mb-3">
        日本株終値 ÷ 米国株終値（同日）のレシオ推移
      </div>
      <div className="h-[180px]">
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
              legend: { display: false },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(255,255,255,0.97)',
                titleColor: '#374151',
                bodyColor: '#8b5cf6',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                padding: 10,
                titleFont: { size: 11, weight: 'bold' },
                bodyFont: { size: 10.5 },
                callbacks: {
                  label: item => {
                    if (item.parsed.y == null) return '';
                    return `${item.dataset.label}: ${item.parsed.y.toFixed(2)}`;
                  },
                },
              },
            },
            scales: {
              x: { grid: { color: '#f0f2f6' }, ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#8a94a6' } },
              y: {
                grid: { color: '#f0f2f6' },
                ticks: { font: { size: 10 }, color: '#8a94a6', callback: v => Number(v).toLocaleString() },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
