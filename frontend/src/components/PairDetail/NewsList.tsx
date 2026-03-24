import { useEffect, useState } from 'react';
import { getNews } from '../../services/api';
import type { NewsItem } from '../../types';

interface Props {
  tickers: { ticker: string; label: string; color: string }[];
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return raw;
  }
}

export default function NewsList({ tickers }: Props) {
  const [newsMap, setNewsMap] = useState<Record<string, NewsItem[]>>({});

  useEffect(() => {
    for (const t of tickers) {
      getNews(t.ticker, 5).then(items => {
        // Sort by date descending (newest first)
        const sorted = [...items].sort((a, b) => {
          const da = new Date(a.published_at).getTime();
          const db = new Date(b.published_at).getTime();
          return db - da;
        });
        setNewsMap(prev => ({ ...prev, [t.ticker]: sorted }));
      }).catch(() => {});
    }
  }, [tickers]);

  return (
    <div className="border border-border rounded-xl p-5 mb-6">
      <div className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-[3px] h-3.5 bg-accent rounded" />
        最新ニュース（各5件）
      </div>
      <div className={`grid gap-5 ${tickers.length >= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {tickers.map(t => (
          <div key={t.ticker}>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 pb-2 border-b-2 border-border flex items-center gap-1.5">
              <span style={{ color: t.color }}>●</span> {t.label}
            </div>
            <ul className="list-none">
              {(newsMap[t.ticker] || []).map((item, i) => (
                <li key={i} className="flex gap-2.5 py-2 border-b border-border last:border-b-0 cursor-pointer group">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium text-text-primary group-hover:text-accent leading-snug block mb-0.5">
                      {item.title}
                    </a>
                    <div className="text-[10.5px] text-text-muted font-mono">{formatDate(item.published_at)} — {item.source}</div>
                  </div>
                </li>
              ))}
              {(!newsMap[t.ticker] || newsMap[t.ticker].length === 0) && (
                <li className="text-xs text-text-muted py-2">ニュースなし</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
