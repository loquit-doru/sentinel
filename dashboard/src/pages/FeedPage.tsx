import type { TokenFeedItem } from '../../../shared/types';
import { TierBadge } from '../components/RiskDisplay';

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function TokenRow({ token, onSelect }: { token: TokenFeedItem; onSelect: (mint: string) => void }) {
  return (
    <button
      onClick={() => onSelect(token.mint)}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-sentinel-surface/80 rounded-lg transition-colors text-left"
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-full bg-sentinel-border flex items-center justify-center shrink-0 overflow-hidden">
        {token.imageUrl ? (
          <img src={token.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-gray-500">{token.symbol.slice(0, 2)}</span>
        )}
      </div>

      {/* Name + Symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{token.name}</p>
        <p className="text-xs text-gray-500">${token.symbol}</p>
      </div>

      {/* Volume */}
      <div className="text-right hidden sm:block">
        <p className="text-xs text-gray-400">Vol 24h</p>
        <p className="text-sm font-mono text-gray-200">{formatUsd(token.volume24h)}</p>
      </div>

      {/* FDV */}
      <div className="text-right hidden md:block">
        <p className="text-xs text-gray-400">FDV</p>
        <p className="text-sm font-mono text-gray-200">{formatUsd(token.fdv)}</p>
      </div>

      {/* Change */}
      <div className="text-right w-16">
        <p className={`text-sm font-mono ${token.priceChangePct24h >= 0 ? 'text-sentinel-safe' : 'text-sentinel-danger'}`}>
          {token.priceChangePct24h >= 0 ? '+' : ''}{token.priceChangePct24h.toFixed(1)}%
        </p>
      </div>

      {/* Risk */}
      <div className="w-20 text-right">
        {token.riskTier ? (
          <TierBadge tier={token.riskTier} />
        ) : (
          <span className="text-xs text-gray-600">—</span>
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
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-sentinel-surface/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-4xl">🔍</p>
        <p className="text-gray-400">No tokens in feed yet.</p>
        <p className="text-gray-600 text-sm">Bags API key needed, or paste a mint address above to scan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
        <div className="w-9 shrink-0" />
        <div className="flex-1 ml-4">Token</div>
        <div className="text-right hidden sm:block w-20">Vol 24h</div>
        <div className="text-right hidden md:block w-20 ml-4">FDV</div>
        <div className="text-right w-16 ml-4">24h</div>
        <div className="text-right w-20 ml-4">Risk</div>
      </div>
      {/* Rows */}
      {tokens.map((t) => (
        <TokenRow key={t.mint} token={t} onSelect={onSelectToken} />
      ))}
    </div>
  );
}
