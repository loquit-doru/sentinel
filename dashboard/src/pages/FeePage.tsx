import { useState, useEffect, useCallback } from 'react';
import type { FeeSnapshot, ClaimablePosition } from '../../../shared/types';
import { fetchFeeSnapshot } from '../api';

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

function formatSol(n: number): string {
  if (n >= 1) return `${n.toFixed(4)} SOL`;
  if (n > 0) return `${(n * 1e6).toFixed(0)} μSOL`;
  return '0 SOL';
}

function PositionRow({ pos, rank }: { pos: ClaimablePosition; rank: number }) {
  const versionBadge = pos.source === 'fee-share-v2'
    ? 'bg-sentinel-accent/10 text-sentinel-accent border-sentinel-accent/30'
    : 'bg-gray-800 text-gray-400 border-gray-700';

  return (
    <div className="group flex items-center gap-4 p-4 rounded-lg border border-sentinel-border/50 hover:border-sentinel-border bg-sentinel-surface/40 hover:bg-sentinel-surface transition-all">
      <span className="text-xs text-gray-600 w-6 text-right font-mono">{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm truncate">{pos.tokenName}</span>
          <span className="text-gray-500 text-xs">{pos.tokenSymbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${versionBadge}`}>
            {pos.source === 'fee-share-v2' ? 'v2' : 'v1'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{pos.tokenMint}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sentinel-safe font-semibold text-sm">{formatUsd(pos.claimableUsd)}</p>
        <p className="text-gray-500 text-xs">{formatSol(pos.claimableAmount)}</p>
      </div>
    </div>
  );
}

export function FeePage() {
  const [wallet, setWallet] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [snapshot, setSnapshot] = useState<FeeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFees = useCallback((w: string) => {
    setWallet(w);
    setLoading(true);
    setError(null);
    fetchFeeSnapshot(w)
      .then(setSnapshot)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 30s when wallet is set
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(() => loadFees(wallet), 30_000);
    return () => clearInterval(id);
  }, [wallet, loadFees]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) loadFees(trimmed);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Fee Optimizer</h2>
        <p className="text-gray-400 text-sm">Discover unclaimed creator fees from Bags positions</p>
      </div>

      {/* Wallet input */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-sentinel-accent transition-colors pointer-events-none">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="13" rx="2" /><path d="M17 11h.01" />
            </svg>
          </div>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter Solana wallet address…"
            spellCheck={false}
            className="w-full bg-sentinel-surface border border-sentinel-border rounded-lg pl-10 pr-28 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sentinel-accent/60 focus:ring-1 focus:ring-sentinel-accent/20 transition-all"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-sentinel-accent hover:bg-sentinel-accent-dim disabled:bg-sentinel-accent/30 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-md transition-all"
          >
            Check
          </button>
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-16 space-y-4 animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-sentinel-accent/10 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-sentinel-accent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm">Checking claimable fees…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-xl p-5 text-center space-y-2 animate-fade-in">
          <p className="text-sentinel-danger font-semibold">Failed to load fees</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => loadFees(wallet)}
            className="text-sm text-sentinel-accent hover:underline mt-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {snapshot && !loading && !error && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary card */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Claimable</p>
                <p className="text-3xl font-bold text-sentinel-safe mt-1">
                  {formatUsd(snapshot.totalClaimableUsd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Positions</p>
                <p className="text-lg font-semibold text-white">{snapshot.positions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sentinel-border/50">
              <code className="text-[11px] text-gray-500 truncate flex-1">{snapshot.wallet}</code>
              <span className="text-[10px] text-gray-600">
                Updated {new Date(snapshot.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Positions list */}
          {snapshot.positions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Claimable Positions
              </h3>
              {snapshot.positions
                .sort((a, b) => b.claimableUsd - a.claimableUsd)
                .map((pos, i) => (
                  <PositionRow key={pos.tokenMint} pos={pos} rank={i + 1} />
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm">No claimable fees found for this wallet.</p>
              <p className="text-xs text-gray-600 mt-1">
                Fees accrue from Bags token creator positions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state: no wallet yet */}
      {!wallet && !loading && (
        <div className="text-center py-12 text-gray-600 space-y-3 animate-fade-in">
          <p className="text-4xl">💰</p>
          <p className="text-sm">Enter a wallet to discover unclaimed Bags creator fees</p>
          <div className="flex flex-wrap justify-center gap-2 text-[10px] text-gray-600">
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Auto Fee Discovery</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">v1 + v2 Positions</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Real-time Data</span>
          </div>
        </div>
      )}
    </div>
  );
}
