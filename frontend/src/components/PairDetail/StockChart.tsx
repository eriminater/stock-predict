import { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { getPrices, getNews } from '../../services/api';
import type { NewsItem } from '../../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface Props {
  ticker: string;
  label: string;
  color: string;
}

export default function StockChart({ ticker, label, color }: Props) {
  const [days, setDays] = useState(30);
  const [prices, setPrices] = useState<{ date: string; close: number }[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  useEffect(() => {
    getPrices(ticker, days).then(data => {
      setPrices([...data].reverse());
    }).catch(() => {});
    getNews(ticker, 10).then(setNews).catch(() => {});
  }, [ticker, days]);

  // Map news dates to chart date labels
  const dateLabels = prices.map(p => {
    const d = new Date(p.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const dateIsos = prices.map(p => p.date); // yyyy-mm-dd

  // Build news marker dataset: for each price date, check if there's a news item
  const newsOnDates: (NewsItem | null)[] = dateIsos.map(isoDate => {
    return news.find(n => {
      try {
        const nd = new Date(n.published_at).toISOString().slice(0, 10);
        return nd === isoDate;
      } catch { return false; }
    }) || null;
  });

  const newsPoints = prices.map((p, i) => newsOnDates[i] ? p.close : null);

  const data = {
    labels: dateLabels,
    datasets: [
      {
        label,
        data: prices.map(p => p.close),
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: true,
      },
      {
        label: 'ニュース',
        data: newsPoints,
        borderColor: 'transparent',
        backgroundColor: '#f59e0b',
        borderWidth: 0,
        pointRadius: newsPoints.map(v => v !== null ? 6 : 0),
        pointHoverRadius: 10,
        pointStyle: 'circle',
        showLine: false,
        fill: false,
      },
    ],
  };

  const handleClick = (_event: unknown, elements: { datasetIndex: number; index: number }[]) => {
    const newsElement = elements.find(e => e.datasetIndex === 1);
    if (newsElement) {
      const newsItem = newsOnDates[newsElement.index];
      if (newsItem) {
        setSelectedNews(newsItem);
      }
    }
  };

  return (
    <div className="border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <span className="w-[3px] h-3.5 bg-accent rounded" />
          {label}
          {news.length > 0 && (
            <span className="text-[10px] text-text-muted font-normal ml-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-0.5" /> ニュースあり＝クリックで表示
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[10, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-0.5 text-[10px] border rounded cursor-pointer transition-all ${
                days === d
                  ? 'border-accent bg-accent-light text-accent font-semibold'
                  : 'border-border bg-surface text-text-muted'
              }`}
            >
              {d}日
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px]">
        <Line
          ref={chartRef}
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            onClick: handleClick as never,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
            },
            scales: {
              x: { grid: { color: '#f0f2f6' }, ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#8a94a6' } },
              y: { grid: { color: '#f0f2f6' }, ticks: { font: { size: 10 }, color: '#8a94a6' } },
            },
          }}
        />
      </div>
      {selectedNews && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 relative">
          <button
            onClick={() => setSelectedNews(null)}
            className="absolute top-2 right-2 text-text-muted hover:text-text-primary text-sm cursor-pointer"
          >
            ✕
          </button>
          <a href={selectedNews.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-text-primary hover:text-accent block mb-1">
            {selectedNews.title}
          </a>
          <div className="text-[10.5px] text-text-muted font-mono">
            {(() => {
              try {
                const d = new Date(selectedNews.published_at);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
              } catch { return selectedNews.published_at; }
            })()} — {selectedNews.source}
          </div>
        </div>
      )}
    </div>
  );
}
