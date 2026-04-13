import { useState } from 'react';
import type { RiskScore, RiskBreakdown } from '../../../shared/types';
import { ScoreGauge, TierBadge, BreakdownBar } from '../components/RiskDisplay';
import { fetchRiskScore } from '../api';

const BREAKDOWN_LABELS: Record<keyof RiskBreakdown, string> = {
  honeypot: 'Honeypot Safety',
  lpLocked: 'LP Locked',
  mintAuthority: 'Mint Revoked',
  freezeAuthority: 'Freeze Revoked',
  topHolderPct: 'Holder Distribution',
  liquidityDepth: 'Liquidity Depth',
  volumeHealth: 'Volume Health',
  creatorReputation: 'Creator Rep',
};

export function RiskDetailPage({ mint, onBack }: { mint: string; onBack: () => void }) {
  const [score, setScore] = useState<RiskScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount
  useState(() => {
    setLoading(true);
    setError(null);
    fetchRiskScore(mint)
      .then(setScore)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button + mint */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <code className="text-xs text-gray-500 bg-sentinel-surface px-2 py-1 rounded truncate">
          {mint}
        </code>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-16 space-y-4">
          <div className="w-16 h-16 border-4 border-sentinel-accent/30 border-t-sentinel-accent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Scanning token…</p>
        </div>
      )}

      {error && (
        <div className="bg-sentinel-danger/10 border border-sentinel-danger/30 rounded-lg p-4 text-center">
          <p className="text-sentinel-danger font-medium">Scan failed</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
          <button
            onClick={onBack}
            className="mt-3 text-sm text-sentinel-accent hover:underline"
          >
            Try another
          </button>
        </div>
      )}

      {score && (
        <>
          {/* Score + Tier */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={score.score} tier={score.tier} size={140} />
            <div className="text-center sm:text-left space-y-2">
              <TierBadge tier={score.tier} />
              <p className="text-gray-400 text-sm">
                {score.tier === 'safe' && 'This token shows strong safety signals.'}
                {score.tier === 'caution' && 'Some risk factors detected. DYOR.'}
                {score.tier === 'danger' && 'Multiple red flags. High risk.'}
                {score.tier === 'rug' && 'Critical risk — likely a scam or rug pull.'}
              </p>
              {score.cached && (
                <p className="text-xs text-gray-600">Cached result</p>
              )}
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Breakdown</h3>
            {(Object.keys(BREAKDOWN_LABELS) as (keyof RiskBreakdown)[]).map((key) => (
              <BreakdownBar key={String(key)} label={BREAKDOWN_LABELS[key]} value={score.breakdown[key]} />
            ))}
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-600 text-center">
            Scored at {new Date(score.timestamp).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
