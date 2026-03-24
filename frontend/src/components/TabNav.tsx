import type { Pair } from '../types';

interface Props {
  pairs: Pair[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNav({ pairs, activeTab, onTabChange }: Props) {
  return (
    <nav className="bg-white border-b border-border px-8 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
      <Tab id="pair-research" label="ペア調査" active={activeTab} onClick={onTabChange} />
      <Tab id="ai-analyst" label="AIアナリスト" active={activeTab} onClick={onTabChange} />
      <div className="ml-auto">
        <Tab id="settings" label="⚙ 設定" active={activeTab} onClick={onTabChange} />
      </div>
    </nav>
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
