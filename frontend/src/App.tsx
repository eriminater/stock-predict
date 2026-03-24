import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TabNav from './components/TabNav';
import PredictionHero from './components/Dashboard/PredictionHero';
import PairDetail from './components/PairDetail';
import PairResearch from './components/PairResearch';
import AIAnalyst from './components/AIAnalyst';
import Settings from './components/Settings';
import { getPairs, createPair, getQuotaStatus, refreshPairNames } from './services/api';
import type { Pair } from './types';

export default function App() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [initializingPairId, setInitializingPairId] = useState<string | null>(null);
  const [quota, setQuota] = useState<Record<string, unknown> | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState(false);

  const loadQuota = useCallback(() => {
    setQuotaLoading(true);
    setQuotaError(false);
    getQuotaStatus()
      .then(data => { setQuota(data); setQuotaLoading(false); })
      .catch(() => { setQuotaError(true); setQuotaLoading(false); });
  }, []);

  const loadPairs = useCallback(() => {
    getPairs()
      .then(data => {
        setPairs(data);
        setPairsLoading(false);
        setLastUpdated(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
        // 名前が未設定のペアはバックグラウンドで一度だけ取得
        const missingNames = data.filter(p => !p.display_name_jp || !p.display_name_us);
        if (missingNames.length > 0) {
          Promise.allSettled(missingNames.map(p => refreshPairNames(p.id)))
            .then(() => getPairs().then(updated => setPairs(updated)).catch(() => {}));
        }
      })
      .catch(() => { setPairsLoading(false); });
  }, []);

  useEffect(() => {
    loadPairs();
    loadQuota();
  }, [loadPairs, loadQuota]);

  const handleRegisterPair = async (us: string, jp: string, ind: string) => {
    try {
      await createPair({ us_ticker: us, jp_ticker: jp, industry_ticker: ind || '^GSPC' });
      loadPairs();
      setActiveTab('settings');
    } catch { /* ignore */ }
  };

  const handlePairInitializing = (pairId: string) => {
    setInitializingPairId(pairId);
    setActiveTab(`pair-${pairId}`);
  };

  const handleInitializingDone = () => {
    setInitializingPairId(null);
    loadPairs();
  };

  const activePairId = activeTab.startsWith('pair-') && activeTab !== 'pair-research'
    ? activeTab.replace('pair-', '')
    : null;
  const activePair = activePairId ? pairs.find(p => p.id === activePairId) : null;

  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} />
      <TabNav pairs={pairs} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="px-4 sm:px-8 py-5 sm:py-7 max-w-[1500px] mx-auto">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            {pairsLoading ? (
              <div className="text-center py-20 text-text-muted">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm">データ読み込み中...</p>
              </div>
            ) : pairs.length === 0 ? (
              <div className="text-center py-20 text-text-muted">
                <p className="text-lg mb-2">ペアが登録されていません</p>
                <p className="text-sm">設定画面からペアを登録してください</p>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="mt-4 px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium cursor-pointer"
                >
                  設定へ移動
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {pairs.map(pair => (
                  <PredictionHero key={pair.id} pair={pair} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pair Detail */}
        {activePair && (
          <PairDetail
            pair={activePair}
            initializing={initializingPairId === activePair.id}
            onInitializingDone={handleInitializingDone}
          />
        )}

        {/* Pair Research */}
        {activeTab === 'pair-research' && (
          <PairResearch onRegisterPair={handleRegisterPair} />
        )}

        {/* AI Analyst */}
        {activeTab === 'ai-analyst' && pairs.length > 0 && (
          <AIAnalyst pairs={pairs} />
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <Settings
            pairs={pairs}
            onPairsChange={loadPairs}
            onPairInitializing={handlePairInitializing}
            onInitializingDone={handleInitializingDone}
            quota={quota}
            quotaLoading={quotaLoading}
            quotaError={quotaError}
            onReloadQuota={loadQuota}
          />
        )}
      </main>
    </div>
  );
}
