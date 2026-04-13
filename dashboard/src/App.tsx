import { useState, useEffect, useCallback } from 'react';
import type { TokenFeedItem } from '../../shared/types';
import { SearchBar } from './components/SearchBar';
import { FeedPage } from './pages/FeedPage';
import { RiskDetailPage } from './pages/RiskDetailPage';
import { fetchTokenFeed } from './api';

type View = { page: 'feed' } | { page: 'risk'; mint: string };

export function App() {
  const [view, setView] = useState<View>({ page: 'feed' });
  const [tokens, setTokens] = useState<TokenFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);

  const loadFeed = useCallback(() => {
    setFeedLoading(true);
    setFeedError(false);
    fetchTokenFeed()
      .then(setTokens)
      .catch(() => setFeedError(true))
      .finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Auto-refresh every 60s when on feed
  useEffect(() => {
    if (view.page !== 'feed') return;
    const id = setInterval(loadFeed, 60_000);
    return () => clearInterval(id);
  }, [view.page, loadFeed]);

  const handleSearch = (mint: string) => setView({ page: 'risk', mint });
  const handleBack = () => setView({ page: 'feed' });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-sentinel-border/50 px-4 sm:px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-sentinel-bg/80 sticky top-0 z-10">
        <button onClick={handleBack} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-sentinel-accent/10 border border-sentinel-accent/30 flex items-center justify-center">
            <span className="text-sentinel-accent text-lg font-bold">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Sentinel</h1>
            <p className="text-[10px] text-gray-500 leading-tight tracking-wide">DON'T TRADE BLIND</p>
          </div>
        </button>
        <div className="flex items-center gap-3">
          {tokens.length > 0 && (
            <span className="text-xs text-gray-600 hidden sm:block">{tokens.length} tokens tracked</span>
          )}
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener"
            className="text-xs text-gray-500 hover:text-sentinel-accent transition-colors px-2.5 py-1 rounded-md border border-sentinel-border/50 hover:border-sentinel-accent/30"
          >
            bags.fm ↗
          </a>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 sm:px-6 py-4 flex justify-center border-b border-sentinel-border/30 bg-sentinel-surface/20">
        <SearchBar onSearch={handleSearch} />
      </div>

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
        {view.page === 'risk' && (
          <RiskDetailPage mint={view.mint} onBack={handleBack} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-sentinel-border/30 px-4 py-3 text-center text-[10px] text-gray-600 tracking-wide">
        SENTINEL v0.1.0 — AI Risk Intelligence for{' '}
        <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent hover:underline">
          Bags
        </a>
        {' · '}Track: AI Agents
      </footer>
    </div>
  );
}
