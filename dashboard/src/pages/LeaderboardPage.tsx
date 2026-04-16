import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api';
import type { LeaderboardEntry, LeaderboardData } from '../api';

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

function tierBadge(tier: string) {
  const cls =
    tier === 'whale' ? 'bg-sentinel-accent/20 text-sentinel-accent border-sentinel-accent/30' :
    tier === 'holder' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
    'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border uppercase ${cls}`}>
      {tier}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm text-gray-500 font-mono w-6 text-center">#{rank}</span>;
}

function EntryRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-sentinel-border/30 hover:bg-white/[0.02] transition-colors">
      <div className="w-10 flex justify-center">
        <RankBadge rank={entry.rank} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-200">{shortWallet(entry.wallet)}</span>
          {tierBadge(entry.tier)}
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold text-gray-200">{entry.scansPerformed}</div>
        <div className="text-[10px] text-gray-500">scans</div>
      </div>

      <div className="text-right w-16">
        <div className="text-sm font-semibold text-sentinel-danger">{entry.rugsDetected}</div>
        <div className="text-[10px] text-gray-500">rugs found</div>
      </div>

      <div className="text-right w-16">
        <div className="text-sm font-semibold text-sentinel-accent">{entry.shareCount}</div>
        <div className="text-[10px] text-gray-500">shares</div>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'alltime'>('weekly');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLeaderboard(period)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            🏆 Leaderboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">Top risk hunters on Sentinel</p>
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 bg-sentinel-surface rounded-lg p-1 border border-sentinel-border/40">
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              period === 'weekly'
                ? 'bg-sentinel-accent/15 text-sentinel-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('alltime')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              period === 'alltime'
                ? 'bg-sentinel-accent/15 text-sentinel-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-sentinel-surface border border-sentinel-border/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-200">{data.totalUsers}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Users</div>
          </div>
          <div className="bg-sentinel-surface border border-sentinel-border/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-200">
              {data.entries.reduce((s, e) => s + e.scansPerformed, 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Scans</div>
          </div>
          <div className="bg-sentinel-surface border border-sentinel-border/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-sentinel-danger">
              {data.entries.reduce((s, e) => s + e.rugsDetected, 0)}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Rugs Detected</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-sentinel-surface border border-sentinel-border/40 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2 bg-sentinel-border/20 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          <div className="w-10 text-center">Rank</div>
          <div className="flex-1">Wallet</div>
          <div className="text-right">Scans</div>
          <div className="text-right w-16">Rugs</div>
          <div className="text-right w-16">Shares</div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-sentinel-accent/30 border-t-sentinel-accent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">Failed to load leaderboard</p>
            <p className="text-xs text-gray-600">{error}</p>
          </div>
        )}

        {!loading && !error && data && data.entries.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">🏜️</p>
            <p className="text-sm text-gray-400">No data yet</p>
            <p className="text-xs text-gray-600 mt-1">Start scanning tokens to appear on the leaderboard!</p>
          </div>
        )}

        {!loading && !error && data && data.entries.map((entry) => (
          <EntryRow key={entry.wallet} entry={entry} />
        ))}
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-sentinel-accent/5 to-transparent border border-sentinel-accent/20 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-200">Want to climb the ranks?</p>
          <p className="text-xs text-gray-500 mt-0.5">Scan tokens, detect rugs, and share risk cards to earn points</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-sentinel-accent/60 uppercase tracking-wider">Hold $SENT for bonus</span>
        </div>
      </div>
    </div>
  );
}
