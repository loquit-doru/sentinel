import { useState, useCallback } from 'react';
import type { FeeRevenueAnalytics, FeeSimulationResult } from '../api';
import { fetchFeeAnalytics, simulateFeeShare } from '../api';

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

function urgencyBadge(urgency: string): { bg: string; text: string; label: string } {
  switch (urgency) {
    case 'critical': return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: '🚨 CRITICAL' };
    case 'warning':  return { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: '⚠️ WARNING' };
    case 'safe':     return { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: '✅ SAFE' };
    default:         return { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', label: '❓ UNKNOWN' };
  }
}

function riskColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 70) return 'text-sentinel-safe';
  if (score >= 40) return 'text-sentinel-caution';
  if (score >= 10) return 'text-sentinel-danger';
  return 'text-sentinel-rug';
}

// ── Simulator Section ────────────────────────────────────

function SimulatorSection() {
  const [volume, setVolume] = useState('10000');
  const [feeBps, setFeeBps] = useState('100');
  const [allocations, setAllocations] = useState([
    { label: 'Creator', bps: 4000 },
    { label: 'Holders', bps: 3000 },
    { label: 'Dev Fund', bps: 2000 },
    { label: 'Partner', bps: 1000 },
  ]);
  const [result, setResult] = useState<FeeSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBps = allocations.reduce((s, a) => s + a.bps, 0);

  const updateAlloc = (idx: number, bps: number) => {
    setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, bps } : a));
  };

  const addAlloc = () => {
    setAllocations((prev) => [...prev, { label: `Recipient ${prev.length + 1}`, bps: 0 }]);
  };

  const removeAlloc = (idx: number) => {
    if (allocations.length <= 1) return;
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const runSim = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await simulateFeeShare({
        expectedDailyVolumeUsd: Number(volume),
        feeRateBps: Number(feeBps),
        allocations,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }, [volume, feeBps, allocations]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        🧮 Fee-Share Simulator
        <span className="text-xs text-gray-500 font-normal">Plan your token launch</span>
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Daily Volume (USD)</label>
          <input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="w-full bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sentinel-accent/50"
            min={0}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Fee Rate (BPS, 100 = 1%)</label>
          <input
            type="number"
            value={feeBps}
            onChange={(e) => setFeeBps(e.target.value)}
            className="w-full bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sentinel-accent/50"
            min={1}
            max={10000}
          />
        </div>
      </div>

      {/* Allocations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500">Allocations (must total 10,000 BPS)</label>
          <span className={`text-xs font-mono ${totalBps === 10000 ? 'text-sentinel-safe' : 'text-sentinel-danger'}`}>
            {totalBps} / 10,000
          </span>
        </div>
        {allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={a.label}
              onChange={(e) => setAllocations((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
              className="flex-1 bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sentinel-accent/50"
              placeholder="Label"
            />
            <input
              type="number"
              value={a.bps}
              onChange={(e) => updateAlloc(i, Number(e.target.value))}
              className="w-24 bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-sentinel-accent/50"
              min={0}
              max={10000}
            />
            <span className="text-xs text-gray-500 w-12 text-right">{(a.bps / 100).toFixed(1)}%</span>
            <button onClick={() => removeAlloc(i)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
          </div>
        ))}
        <button onClick={addAlloc} className="text-xs text-sentinel-accent hover:underline">+ Add recipient</button>
      </div>

      <button
        onClick={runSim}
        disabled={loading || totalBps !== 10000}
        className="w-full py-2.5 rounded-lg font-medium text-sm transition-all bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25 hover:bg-sentinel-accent/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Simulating…' : 'Run Simulation'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3 animate-fade-in">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Daily', val: result.dailyFeesUsd },
              { label: 'Weekly', val: result.weeklyFeesUsd },
              { label: 'Monthly', val: result.monthlyFeesUsd },
              { label: 'Yearly', val: result.yearlyFeesUsd },
            ].map(({ label, val }) => (
              <div key={label} className="bg-sentinel-surface/50 border border-sentinel-border/30 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-white">{formatUsd(val)}</p>
              </div>
            ))}
          </div>

          {/* Per-recipient breakdown */}
          <div className="space-y-2">
            {result.perRecipient.map((r) => (
              <div key={r.label} className="flex items-center gap-3 p-3 rounded-lg bg-sentinel-surface/30 border border-sentinel-border/20">
                <span className="text-sm text-white font-medium flex-1">{r.label}</span>
                <span className="text-xs text-gray-500">{r.pctShare}%</span>
                <span className="text-sm text-sentinel-accent font-mono">{formatUsd(r.monthlyUsd)}/mo</span>
              </div>
            ))}
          </div>

          {/* Comparison */}
          <p className="text-xs text-gray-500 text-center">
            Your volume is{' '}
            <span className={result.comparisonToMedian.yourVsMedianPct >= 0 ? 'text-sentinel-safe' : 'text-sentinel-caution'}>
              {result.comparisonToMedian.yourVsMedianPct >= 0 ? '+' : ''}{result.comparisonToMedian.yourVsMedianPct}%
            </span>{' '}
            vs median Bags token (${formatUsd(result.comparisonToMedian.medianDailyVolumeUsd)}/day)
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

export function FeeAnalyticsPage({ connectedWallet }: { connectedWallet: string | null }) {
  const [wallet, setWallet] = useState(connectedWallet ?? '');
  const [analytics, setAnalytics] = useState<FeeRevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'analytics' | 'simulator'>('analytics');

  const load = useCallback(() => {
    if (!wallet || wallet.length < 32) return;
    setLoading(true);
    setError(null);
    fetchFeeAnalytics(wallet)
      .then(setAnalytics)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [wallet]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">📊 Fee Intelligence</h2>
        <p className="text-sm text-gray-500 mt-1">Revenue analytics, yield projections & fee-share simulator</p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2">
        {(['analytics', 'simulator'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t
                ? 'bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25'
                : 'text-gray-500 hover:text-gray-300 border border-sentinel-border/40 hover:bg-white/5'
            }`}
          >
            {t === 'analytics' ? '📊 Revenue Analytics' : '🧮 Fee Simulator'}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <div className="space-y-4">
          {/* Wallet input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Enter Solana wallet address…"
              className="flex-1 bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sentinel-accent/50 placeholder-gray-600"
            />
            <button
              onClick={load}
              disabled={loading || wallet.length < 32}
              className="px-5 py-2.5 bg-sentinel-accent/15 text-sentinel-accent border border-sentinel-accent/25 rounded-lg text-sm font-medium hover:bg-sentinel-accent/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-sentinel-accent/30 border-t-sentinel-accent rounded-full animate-spin" />
            </div>
          )}

          {analytics && !loading && (
            <div className="space-y-4 animate-fade-in">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Claimable" value={formatUsd(analytics.totalClaimableUsd)} accent />
                <StatCard label="Daily Accrual" value={formatUsd(analytics.totalDailyAccrualUsd)} />
                <StatCard label="Monthly (est.)" value={formatUsd(analytics.projectedMonthlyUsd)} />
                <StatCard label="Yearly (est.)" value={formatUsd(analytics.projectedYearlyUsd)} />
              </div>

              {/* Health bar */}
              <div className="bg-sentinel-surface/50 border border-sentinel-border/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Portfolio Risk Score</span>
                  <span className={`text-lg font-bold font-mono ${riskColor(analytics.riskAdjustedScore)}`}>
                    {analytics.riskAdjustedScore}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${analytics.riskAdjustedScore}%`,
                      backgroundColor: analytics.riskAdjustedScore >= 70 ? '#22c55e' : analytics.riskAdjustedScore >= 40 ? '#eab308' : '#ef4444',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{analytics.safePositionsPct}% in safe tokens</span>
                  {analytics.topEarner && (
                    <span>Top earner: <span className="text-sentinel-accent">{analytics.topEarner.symbol}</span> ({formatUsd(analytics.topEarner.dailyUsd)}/day)</span>
                  )}
                </div>
              </div>

              {/* Position list */}
              {analytics.positions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-400">Fee Positions ({analytics.positions.length})</h3>
                  {analytics.positions.map((pos) => {
                    const ub = urgencyBadge(pos.urgency);
                    return (
                      <div
                        key={pos.tokenMint}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${ub.bg} transition-all`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{pos.tokenName}</span>
                            <span className="text-xs text-gray-500">{pos.tokenSymbol}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ub.bg} ${ub.text} font-semibold`}>
                              {ub.label}
                            </span>
                            {pos.riskScore !== null && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono ${riskColor(pos.riskScore)}`}>
                                Risk: {pos.riskScore}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            {pos.dailyAccrualUsd !== null && <span>~{formatUsd(pos.dailyAccrualUsd)}/day</span>}
                            {pos.estimatedApy !== null && <span>~{pos.estimatedApy.toFixed(1)}% APY</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-white font-medium">{formatUsd(pos.claimableUsd)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {analytics.positions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-2xl mb-2">💰</p>
                  <p className="text-sm">No fee positions found for this wallet.</p>
                  <p className="text-xs mt-1">Create tokens on bags.fm to start earning fees!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'simulator' && <SimulatorSection />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-sentinel-surface/50 border border-sentinel-border/30 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${accent ? 'text-sentinel-accent' : 'text-white'}`}>{value}</p>
    </div>
  );
}
