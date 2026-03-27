import { useRef, useState, useEffect } from 'react';
import type { Pair } from '../types';

interface Props {
  pairs: Pair[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNav({ pairs, activeTab, onTabChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 1);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [pairs]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative bg-white border-b border-border">
      {showLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 h-full px-2 z-10 bg-gradient-to-r from-white to-transparent cursor-pointer text-text-muted hover:text-text-secondary"
        >
          ‹
        </button>
      )}
      <div ref={scrollRef} className="flex overflow-x-auto px-8" style={{ scrollbarWidth: 'none' }}>
        <Tab id="dashboard" label="ダッシュボード" active={activeTab} onClick={onTabChange} />
        {pairs.map(p => (
          <Tab
            key={p.id}
            id={`pair-${p.id}`}
            label={`${p.us_ticker} / ${p.jp_ticker.replace('.T', '')}`}
            active={activeTab}
            onClick={onTabChange}
          />
        ))}
      </div>
      {showRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 h-full px-2 z-10 bg-gradient-to-l from-white to-transparent cursor-pointer text-text-muted hover:text-text-secondary"
        >
          ›
        </button>
      )}
    </div>
  );
}

function Tab({ id, label, active, onClick }: { id: string; label: string; active: string; onClick: (t: string) => void }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-5 py-3.5 text-[13.5px] font-medium border-b-2 whitespace-nowrap transition-all cursor-pointer ${
        isActive
          ? 'text-accent border-accent'
          : 'text-text-muted border-transparent hover:text-text-secondary'
      }`}
    >
      {label}
    </button>
  );
}
