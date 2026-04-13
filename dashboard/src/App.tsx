import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchTokenFeed()
      .then(setTokens)
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, []);

  const handleSearch = (mint: string) => setView({ page: 'risk', mint });
  const handleBack = () => setView({ page: 'feed' });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-sentinel-border px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={handleBack} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="text-sentinel-accent text-2xl font-bold">⬡</span>
          <h1 className="text-xl font-bold">Sentinel</h1>
        </button>
        <p className="text-sm text-gray-500 hidden sm:block">Don't trade blind.</p>
      </header>

      {/* Search */}
      <div className="px-4 sm:px-6 py-4 flex justify-center border-b border-sentinel-border/50">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
        {view.page === 'feed' && (
          <FeedPage tokens={tokens} loading={feedLoading} onSelectToken={handleSearch} />
        )}
        {view.page === 'risk' && (
          <RiskDetailPage mint={view.mint} onBack={handleBack} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-sentinel-border px-4 py-3 text-center text-xs text-gray-600">
        Sentinel v0.1.0 — AI Risk Intelligence for{' '}
        <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent hover:underline">
          Bags
        </a>
      </footer>
    </div>
  );
}
