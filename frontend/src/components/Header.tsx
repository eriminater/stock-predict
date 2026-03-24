interface Props {
  lastUpdated: string | null;
}

export default function Header({ lastUpdated }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-white/92 backdrop-blur-[12px] border-b border-border h-14 px-8 flex items-center justify-between">
      <div className="flex items-center gap-2.5 font-semibold text-[17px] tracking-tight">
        <div className="w-7 h-7 bg-gradient-to-br from-accent to-accent2 rounded-[7px] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12 L5 7 L8 9 L11 4 L14 6" />
          </svg>
        </div>
        StockPredict
      </div>
      <div className="flex items-center gap-4">
        {lastUpdated && (
          <div className="font-mono text-[11px] text-text-muted bg-surface border border-border rounded-md px-2.5 py-1">
            最終更新: {lastUpdated}
          </div>
        )}
      </div>
    </header>
  );
}
