import { useRef, useState, useEffect } from 'react';
import type { Pair } from '../types';

interface Props {
  pairs: Pair[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNav({ pairs, activeTab, onTabChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const checkFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkFade();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkFade);
    window.addEventListener('resize', checkFade);
    return () => {
      el?.removeEventListener('scroll', checkFade);
      window.removeEventListener('resize', checkFade);
    };
  }, [pairs]);

  return (
    <div className="relative bg-white border-b border-border">
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
      {showFade && (
        <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-white to-transparent pointer-events-none" />
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
