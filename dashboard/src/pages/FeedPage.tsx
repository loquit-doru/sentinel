import { useState, useMemo } from 'react';
import type { TokenFeedItem } from '../../../shared/types';
import { TierBadge } from '../components/RiskDisplay';

type SortField = 'volume' | 'fdv' | 'change' | 'fees';
type FilterTier = 'all' | 'safe' | 'caution' | 'danger';

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatFees(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${(n / 1e3).toFixed(0)}K`;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'fees', label: 'Lifetime Fees' },
  { value: 'volume', label: 'Volume 24h' },
  { value: 'fdv', label: 'FDV' },
  { value: 'change', label: 'Price Change' },
];

const FILTER_OPTIONS: { value: FilterTier; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'text-gray-300' },
  { value: 'safe', label: 'Safe', color: 'text-sentinel-safe' },
  { value: 'caution', label: 'Caution', color: 'text-sentinel-caution' },
  { value: 'danger', label: 'Risky', color: 'text-sentinel-danger' },
];

function SortButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-all ${
        active
          ? 'bg-sentinel-accent/20 text-sentinel-accent border border-sentinel-accent/40'
          : 'text-gray-500 hover:text-gray-300 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function TokenRow({ token, onSelect, index }: { token: TokenFeedItem; onSelect: (mint: string) => void; index: number }) {
  return (
    <button
      onClick={() => onSelect(token.mint)}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-sentinel-accent/5 rounded-lg transition-all text-left group"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      {/* Rank */}
      <span className="text-xs text-gray-600 w-5 text-right font-mono">{index + 1}</span>

      {/* Icon */}
      <div className="w-9 h-9 rounded-full bg-sentinel-border flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-sentinel-border group-hover:ring-sentinel-accent/30 transition-all">
        {token.imageUrl ? (
          <img src={token.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-xs text-gray-500 font-medium">{token.symbol.slice(0, 2)}</span>
        )}
      </div>

      {/* Name + Symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-sentinel-accent transition-colors">{token.name}</p>
        <p className="text-xs text-gray-500">${token.symbol}</p>
      </div>

      {/* Volume */}
      <div className="text-right hidden sm:block w-20">
        <p className="text-sm font-mono text-gray-300">{formatUsd(token.volume24h)}</p>
        <p className="text-[10px] text-gray-600">vol 24h</p>
      </div>

      {/* FDV */}
      <div className="text-right hidden md:block w-20">
        <p className="text-sm font-mono text-gray-300">{formatUsd(token.fdv)}</p>
        <p className="text-[10px] text-gray-600">FDV</p>
      </div>

      {/* Change */}
      <div className="text-right w-16">
        <p className={`text-sm font-mono font-medium ${token.priceChangePct24h >= 0 ? 'text-sentinel-safe' : 'text-sentinel-danger'}`}>
          {token.priceChangePct24h >= 0 ? '+' : ''}{token.priceChangePct24h.toFixed(1)}%
        </p>
      </div>

      {/* Risk */}
      <div className="w-20 text-right">
        {token.riskTier ? (
          <TierBadge tier={token.riskTier} />
        ) : (
          <span className="text-[10px] text-gray-600 px-2 py-0.5 border border-sentinel-border rounded-full">scan →</span>
        )}
      </div>
    </button>
  );
}

export function FeedPage({ tokens, loading, onSelectToken }: {
  tokens: TokenFeedItem[];
  loading: boolean;
  onSelectToken: (mint: string) => void;
}) {
  const [sortBy, setSortBy] = useState<SortField>('fees');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = [...tokens];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q)
      );
    }

    // Tier filter
    if (filterTier !== 'all') {
      result = result.filter(t => {
        if (!t.riskTier) return filterTier === 'caution'; // unscored → show in caution
        if (filterTier === 'danger') return t.riskTier === 'danger' || t.riskTier === 'rug';
        return t.riskTier === filterTier;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'volume': return b.volume24h - a.volume24h;
        case 'fdv': return b.fdv - a.fdv;
        case 'change': return b.priceChangePct24h - a.priceChangePct24h;
        case 'fees': return b.lifetimeFees - a.lifetimeFees;
      }
    });

    return result;
  }, [tokens, sortBy, filterTier, search]);

  if (loading) {
    return (
      <div className="space-y-1">
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 w-20 bg-sentinel-surface/50 rounded-md animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[60px] bg-sentinel-surface/30 rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-sentinel-surface border border-sentinel-border flex items-center justify-center">
          <span className="text-2xl">🔍</span>
        </div>
        <p className="text-gray-400">No tokens in feed yet.</p>
        <p className="text-gray-600 text-sm">Paste a mint address above to scan any Solana token.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Sort */}
        <div className="flex gap-1.5 flex-wrap">
          {SORT_OPTIONS.map(opt => (
            <SortButton key={opt.value} active={sortBy === opt.value} label={opt.label} onClick={() => setSortBy(opt.value)} />
          ))}
        </div>

        {/* Filter + Search */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterTier(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  filterTier === opt.value
                    ? `${opt.color} bg-white/5 border border-white/10`
                    : 'text-gray-600 hover:text-gray-400 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-28 sm:w-36 bg-sentinel-surface/50 border border-sentinel-border rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-sentinel-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>{filtered.length} tokens</span>
        <span className="text-sentinel-safe">{tokens.filter(t => t.priceChangePct24h > 0).length} ↑</span>
        <span className="text-sentinel-danger">{tokens.filter(t => t.priceChangePct24h < 0).length} ↓</span>
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 py-2 text-[10px] text-gray-600 uppercase tracking-widest border-b border-sentinel-border/50">
        <div className="w-5 text-right mr-4">#</div>
        <div className="w-9 shrink-0" />
        <div className="flex-1 ml-4">Token</div>
        <div className="text-right hidden sm:block w-20">Volume</div>
        <div className="text-right hidden md:block w-20">FDV</div>
        <div className="text-right w-16">24h</div>
        <div className="text-right w-20">Risk</div>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No tokens match your filters.
        </div>
      ) : (
        filtered.map((t, i) => (
          <TokenRow key={t.mint} token={t} onSelect={onSelectToken} index={i} />
        ))
      )}
    </div>
  );
}
