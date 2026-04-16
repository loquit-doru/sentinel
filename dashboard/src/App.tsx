import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { TokenFeedItem } from '../../shared/types';
import { SearchBar } from './components/SearchBar';
import { FeedPage } from './pages/FeedPage';
import { RiskDetailPage } from './pages/RiskDetailPage';
import { WalletXRayPage } from './pages/WalletXRayPage';
import { FeePage } from './pages/FeePage';
import { AlertFeedPage } from './pages/AlertFeedPage';
import { CreatorProfilePage } from './pages/CreatorProfilePage';
import { LandingPage } from './pages/LandingPage';
import { ClaimPage } from './pages/ClaimPage';
import BagsNativePage from './pages/BagsNativePage';
import { SwarmPage } from './pages/SwarmPage';
import { MonitorPage } from './pages/MonitorPage';
import { FirewallPage } from './pages/FirewallPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { FeeAnalyticsPage } from './pages/FeeAnalyticsPage';
import { InsurancePage } from './pages/InsurancePage';
import { SimulatorPage } from './pages/SimulatorPage';
import { fetchTokenFeed } from './api';

type View =
  | { page: 'landing' }
  | { page: 'feed' }
  | { page: 'risk'; mint: string }
  | { page: 'xray' }
  | { page: 'fees' }
  | { page: 'alerts' }
  | { page: 'creator'; wallet: string }
  | { page: 'claim'; claimId: string }
  | { page: 'bags' }
  | { page: 'swarm' }
  | { page: 'monitor' }
  | { page: 'firewall' }
  | { page: 'leaderboard' }
  | { page: 'fee-analytics' }
  | { page: 'insurance' }
  | { page: 'simulator' };

function SentinelLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3L4 8v8c0 6.627 5.148 12.347 12 13.93C22.852 28.347 28 22.627 28 16V8L16 3z"
        fill="rgba(6,182,212,0.12)"
        stroke="rgba(6,182,212,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.5" fill="#06b6d4" />
      <path d="M16 10v2M16 20v2M10 16h2M20 16h2" stroke="#06b6d4" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

type TabId = 'discover' | 'xray' | 'alerts' | 'fees' | 'swarm' | 'monitor' | 'firewall' | 'bags' | 'leaderboard' | 'fee-analytics' | 'insurance' | 'simulator';

const PRIMARY_TABS: { id: TabId; label: string }[] = [
  { id: 'discover', label: 'Discovery' },
  { id: 'xray',     label: 'Wallet X-Ray' },
  { id: 'alerts',   label: 'Risk Alerts' },
  { id: 'fees',     label: 'AutoClaim' },
  { id: 'swarm',    label: 'AI Swarm' },
  { id: 'monitor',  label: 'Monitor' },
];

const MORE_TABS: { id: TabId; label: string }[] = [
  { id: 'leaderboard', label: '🏆 Leaderboard' },
  { id: 'fee-analytics', label: '📊 Fee Intel' },
  { id: 'simulator', label: '🧪 Simulator' },
  { id: 'insurance', label: '🏦 Insurance' },
  { id: 'firewall', label: '🛡️ Firewall' },
  { id: 'bags',     label: 'Bags Native' },
];

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

export function App() {
  const { publicKey } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;

  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    const claimId = params.get('claim');
    if (claimId && claimId.length >= 10) return { page: 'claim', claimId };
    const risk = params.get('risk');
    if (risk && risk.length >= 32) return { page: 'risk', mint: risk };
    return { page: 'landing' };
  });
  const [tokens, setTokens] = useState<TokenFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(() => {
    setFeedLoading(true);
    setFeedError(false);
    fetchTokenFeed()
      .then(setTokens)
      .catch(() => setFeedError(true))
      .finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    if (view.page !== 'feed') return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadFeed();
    }, 60_000);
    return () => clearInterval(id);
  }, [view.page, loadFeed]);

  // Close "More" dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (mint: string) => setView({ page: 'risk', mint });
  const goFeed     = () => setView({ page: 'feed' });
  const goXRay     = () => setView({ page: 'xray' });
  const goFees     = () => setView({ page: 'fees' });
  const goAlerts   = () => setView({ page: 'alerts' });
  const goCreator  = (wallet: string) => setView({ page: 'creator', wallet });
  const goBags     = () => setView({ page: 'bags' });
  const goSwarm    = () => setView({ page: 'swarm' });
  const goMonitor  = () => setView({ page: 'monitor' });
  const goFirewall = () => setView({ page: 'firewall' });
  const goLeaderboard = () => setView({ page: 'leaderboard' });
  const goFeeAnalytics = () => setView({ page: 'fee-analytics' });
  const goInsurance = () => setView({ page: 'insurance' });
  const goSimulator = () => setView({ page: 'simulator' });

  const tabGoHandlers: Record<TabId, () => void> = {
    discover: goFeed, xray: goXRay, alerts: goAlerts, fees: goFees,
    swarm: goSwarm, monitor: goMonitor, firewall: goFirewall, bags: goBags, leaderboard: goLeaderboard, 'fee-analytics': goFeeAnalytics, insurance: goInsurance, simulator: goSimulator,
  };

  if (view.page === 'landing') return <LandingPage onLaunch={goFeed} />;

  if (view.page === 'claim') {
    return (
      <ClaimPage
        claimId={view.claimId}
        onDone={() => {
          window.history.replaceState({}, '', window.location.pathname);
          goFees();
        }}
      />
    );
  }

  const activeTab: TabId =
    view.page === 'fees'                              ? 'fees'     :
    view.page === 'alerts' || view.page === 'creator' ? 'alerts'   :
    view.page === 'xray'                              ? 'xray'     :
    view.page === 'swarm'                             ? 'swarm'    :
    view.page === 'monitor'                           ? 'monitor'   :
    view.page === 'firewall'                          ? 'firewall'  :
    view.page === 'leaderboard'                       ? 'leaderboard' :
    view.page === 'fee-analytics'                     ? 'fee-analytics' :
    view.page === 'insurance'                          ? 'insurance' :
    view.page === 'simulator'                          ? 'simulator' :
    view.page === 'bags'                              ? 'bags'     :
    'discover';

  const activeInMore = MORE_TABS.some(t => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-sentinel-border/50 px-4 sm:px-6 py-3 flex items-center justify-between backdrop-blur-md bg-sentinel-bg/90 sticky top-0 z-20">
        <button onClick={goFeed} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <SentinelLogo size={28} />
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">Sentinel</h1>
            <p className="text-[9px] text-gray-600 leading-tight tracking-widest uppercase">Don't trade blind</p>
          </div>
        </button>

        {/* Primary nav pills — desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {PRIMARY_TABS.map(tab => (
            <NavTab key={tab.id} active={activeTab === tab.id} onClick={tabGoHandlers[tab.id]}>
              {tab.label}
            </NavTab>
          ))}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1 ${
                activeInMore
                  ? 'bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              {activeInMore ? MORE_TABS.find(t => t.id === activeTab)?.label : 'More'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-sentinel-surface border border-sentinel-border/60 rounded-xl shadow-xl shadow-black/40 py-1 z-30 animate-fade-in">
                {MORE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { tabGoHandlers[tab.id](); setMoreOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'text-sentinel-accent bg-sentinel-accent/8'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          {tokens.length > 0 && (
            <span className="text-xs text-gray-600 hidden lg:block">{tokens.length} tokens</span>
          )}
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener"
            className="text-xs text-gray-500 hover:text-sentinel-accent transition-colors px-2.5 py-1.5 rounded-lg border border-sentinel-border/50 hover:border-sentinel-accent/30 hidden sm:block"
          >
            bags.fm ↗
          </a>
          <WalletMultiButton className="!bg-sentinel-accent/15 !border !border-sentinel-accent/25 !rounded-lg !h-9 !text-xs !font-medium !text-sentinel-accent hover:!bg-sentinel-accent/25 !transition-all" />
        </div>
      </header>

      {/* Mobile nav — horizontal scroll pills */}
      <div className="md:hidden px-4 py-2 border-b border-sentinel-border/30 bg-sentinel-surface/10 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {[...PRIMARY_TABS, ...MORE_TABS].map(tab => (
          <button
            key={tab.id}
            onClick={tabGoHandlers[tab.id]}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25'
                : 'text-gray-500 hover:text-gray-300 border border-sentinel-border/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (discovery only) */}
      {activeTab === 'discover' && (
        <div className="px-4 sm:px-6 py-4 flex justify-center border-b border-sentinel-border/30 bg-sentinel-surface/10">
          <SearchBar onSearch={handleSearch} />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
        {view.page === 'feed' && (
          <>
            {feedError && !feedLoading && (
              <div className="mb-4 p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg flex items-center justify-between">
                <p className="text-sm text-gray-400">Failed to load token feed.</p>
                <button onClick={loadFeed} className="text-xs text-sentinel-accent hover:underline">Retry</button>
              </div>
            )}
            <FeedPage tokens={tokens} loading={feedLoading} onSelectToken={handleSearch} />
          </>
        )}
        {view.page === 'risk'     && <RiskDetailPage mint={view.mint} onBack={goFeed} />}
        {view.page === 'xray'     && <WalletXRayPage onViewToken={handleSearch} connectedWallet={connectedWallet} />}
        {view.page === 'fees'     && <FeePage />}
        {view.page === 'alerts'   && <AlertFeedPage onViewToken={handleSearch} onViewCreator={goCreator} />}
        {view.page === 'creator'  && <CreatorProfilePage wallet={view.wallet} onBack={goAlerts} onViewToken={handleSearch} />}
        {view.page === 'swarm'    && <SwarmPage connectedWallet={connectedWallet} />}
        {view.page === 'monitor'  && <MonitorPage connectedWallet={connectedWallet} />}
        {view.page === 'firewall' && <FirewallPage connectedWallet={connectedWallet} />}
        {view.page === 'leaderboard' && <LeaderboardPage />}
        {view.page === 'fee-analytics' && <FeeAnalyticsPage connectedWallet={connectedWallet} />}
        {view.page === 'insurance' && <InsurancePage connectedWallet={connectedWallet} />}
        {view.page === 'simulator' && <SimulatorPage onViewToken={handleSearch} />}
        {view.page === 'bags'     && <BagsNativePage connectedWallet={connectedWallet} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-sentinel-border/30 px-6 py-4 flex items-center justify-between text-[11px] text-gray-600">
        <div className="flex items-center gap-2">
          <SentinelLogo size={14} />
          <span>Sentinel v0.13.0</span>
        </div>
        <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent/60 hover:text-sentinel-accent transition-colors">
          bags.fm ↗
        </a>
      </footer>
    </div>
  );
}
