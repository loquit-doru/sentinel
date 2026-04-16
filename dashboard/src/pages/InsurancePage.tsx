import { useState, useEffect } from 'react';
import {
  fetchInsurancePool,
  commitToInsurance,
  submitInsuranceClaim,
  fetchWalletClaims,
  fetchRecentClaims,
} from '../api';
import type {
  InsurancePoolStats,
  InsuranceClaim,
} from '../api';

function statusBadge(s: InsuranceClaim['status']) {
  if (s === 'approved') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">Approved</span>;
  if (s === 'denied')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">Denied</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pending</span>;
}

function tierLabel(tier: string) {
  if (tier === 'whale-shield') return '🐋 Whale Shield';
  if (tier === 'guardian') return '🛡️ Guardian';
  return '💰 Backer';
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${accent ? 'text-sentinel-accent' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function InsurancePage({ connectedWallet }: { connectedWallet: string | null }) {
  const [tab, setTab] = useState<'pool' | 'commit' | 'claim' | 'history'>('pool');

  const [pool, setPool] = useState<InsurancePoolStats | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [recentClaims, setRecentClaims] = useState<InsuranceClaim[]>([]);
  const [myClaims, setMyClaims] = useState<InsuranceClaim[]>([]);

  // Commit form
  const [commitAmount, setCommitAmount] = useState('1000');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  // Claim form
  const [claimMint, setClaimMint] = useState('');
  const [claimSymbol, setClaimSymbol] = useState('');
  const [claimLoss, setClaimLoss] = useState('');
  const [claimEntryScore, setClaimEntryScore] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<InsuranceClaim | null>(null);
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    setPoolLoading(true);
    Promise.all([
      fetchInsurancePool().catch(() => null),
      fetchRecentClaims().catch(() => []),
    ]).then(([p, c]) => {
      if (p) setPool(p);
      setRecentClaims(c);
    }).finally(() => setPoolLoading(false));
  }, []);

  useEffect(() => {
    if (connectedWallet && tab === 'history') {
      fetchWalletClaims(connectedWallet).then(setMyClaims).catch(() => {});
    }
  }, [connectedWallet, tab]);

  const doCommit = async () => {
    if (!connectedWallet) return;
    const amount = parseFloat(commitAmount);
    if (!amount || amount <= 0) return;
    setCommitting(true);
    setCommitResult(null);
    try {
      const { commitment, poolStats } = await commitToInsurance(connectedWallet, amount);
      setPool(poolStats);
      setCommitResult(`Committed ${commitment.amountSent.toLocaleString()} $SENT as ${tierLabel(commitment.tier)}`);
    } catch (err) {
      setCommitResult(err instanceof Error ? err.message : 'Failed to commit');
    }
    setCommitting(false);
  };

  const doClaim = async () => {
    if (!connectedWallet) { setClaimError('Connect wallet'); return; }
    const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!SOLANA_RE.test(claimMint)) { setClaimError('Invalid token mint'); return; }
    const loss = parseFloat(claimLoss);
    const entry = parseInt(claimEntryScore, 10);
    if (!loss || loss <= 0) { setClaimError('Enter estimated loss in USD'); return; }
    if (isNaN(entry) || entry < 0 || entry > 100) { setClaimError('Entry score must be 0-100'); return; }

    setClaiming(true);
    setClaimError('');
    setClaimResult(null);
    try {
      const claim = await submitInsuranceClaim({
        wallet: connectedWallet,
        tokenMint: claimMint,
        tokenSymbol: claimSymbol || 'UNKNOWN',
        lossEstimateUsd: loss,
        riskScoreAtEntry: entry,
      });
      setClaimResult(claim);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Claim failed');
    }
    setClaiming(false);
  };

  const healthColor = pool
    ? pool.poolHealthPct >= 70 ? 'text-sentinel-safe'
    : pool.poolHealthPct >= 40 ? 'text-sentinel-caution'
    : 'text-sentinel-danger'
    : 'text-gray-500';

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          🏦 Insurance Pool
          <span className="text-xs font-normal text-sentinel-accent px-2 py-0.5 rounded-full border border-sentinel-accent/30">Beta</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Community-backed rug protection — stake $SENT to back the pool, claim when tokens rug.
        </p>
      </div>

      {/* Pool Overview */}
      {poolLoading ? (
        <p className="text-sm text-gray-500 animate-pulse">Loading pool data...</p>
      ) : pool ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Pool Size" value={`${(pool.totalCommittedSent / 1000).toFixed(1)}K $SENT`} accent />
          <StatCard label="Backers" value={pool.totalCommittors.toLocaleString()} />
          <StatCard label="Claims Filed" value={pool.totalClaimsSubmitted.toLocaleString()} />
          <div className="p-3 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pool Health</p>
            <p className={`text-lg font-bold mt-0.5 ${healthColor}`}>{pool.poolHealthPct}%</p>
            <div className="w-full h-1.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pool.poolHealthPct >= 70 ? 'bg-sentinel-safe' : pool.poolHealthPct >= 40 ? 'bg-sentinel-caution' : 'bg-sentinel-danger'}`}
                style={{ width: `${pool.poolHealthPct}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sentinel-border/30 pb-1">
        {([['pool', '📊 Activity'], ['commit', '💰 Back Pool'], ['claim', '📝 File Claim'], ['history', '📜 My Claims']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              tab === id
                ? 'bg-sentinel-accent/15 text-sentinel-accent border-b-2 border-sentinel-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Activity Tab ─── */}
      {tab === 'pool' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Recent Claims</h3>
          {recentClaims.length === 0 ? (
            <p className="text-sm text-gray-500">No claims yet. The pool is healthy.</p>
          ) : (
            recentClaims.map(claim => (
              <div key={claim.id} className="p-3 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/20 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {statusBadge(claim.status)}
                    <span className="text-sm font-bold text-white">{claim.tokenSymbol}</span>
                    <span className="text-[10px] text-gray-600 font-mono">{claim.wallet.slice(0, 6)}...{claim.wallet.slice(-4)}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{claim.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-sentinel-danger">${claim.lossEstimateUsd.toFixed(0)}</p>
                  <p className="text-[10px] text-gray-600">{claim.riskScoreAtEntry} → {claim.riskScoreNow}</p>
                  <p className="text-[9px] text-gray-700">{new Date(claim.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}

          {/* Commitment tiers info */}
          <div className="p-4 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/10 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Commitment Tiers</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { tier: '💰 Backer', min: '1+', desc: 'Base coverage participation' },
                { tier: '🛡️ Guardian', min: '10K+', desc: 'Priority claim review' },
                { tier: '🐋 Whale Shield', min: '100K+', desc: 'Max pool influence' },
              ].map(t => (
                <div key={t.tier} className="p-3 rounded-lg border border-sentinel-border/20 bg-sentinel-surface/20">
                  <p className="text-xs font-bold text-white">{t.tier}</p>
                  <p className="text-[10px] text-sentinel-accent">{t.min} $SENT</p>
                  <p className="text-[10px] text-gray-600 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Commit Tab ─── */}
      {tab === 'commit' && (
        <div className="space-y-4">
          {!connectedWallet ? (
            <p className="text-sm text-sentinel-caution">Connect your wallet to back the insurance pool.</p>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
                <p className="text-sm text-gray-300">
                  Pledge $SENT tokens to back the rug protection pool. Commitments signal intent to
                  cover community losses from verified rug pulls on Bags.
                </p>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Amount ($SENT)"
                    value={commitAmount}
                    onChange={e => setCommitAmount(e.target.value)}
                    className="flex-1 px-4 py-3 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-xl text-white text-sm focus:outline-none focus:border-sentinel-accent/50"
                  />
                  <button
                    onClick={doCommit}
                    disabled={committing}
                    className="px-6 py-3 bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
                  >
                    {committing ? 'Committing...' : 'Back Pool'}
                  </button>
                </div>
                <div className="flex gap-2">
                  {['1000', '10000', '50000', '100000'].map(v => (
                    <button key={v} onClick={() => setCommitAmount(v)}
                      className="px-3 py-1.5 text-[10px] rounded-lg border border-sentinel-border/30 text-gray-400 hover:text-white hover:border-sentinel-accent/30 transition-all">
                      {Number(v).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              {commitResult && (
                <div className="p-3 rounded-xl border border-sentinel-accent/30 bg-sentinel-accent/5 text-sm text-sentinel-accent">
                  {commitResult}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Claim Tab ─── */}
      {tab === 'claim' && (
        <div className="space-y-4">
          {!connectedWallet ? (
            <p className="text-sm text-sentinel-caution">Connect your wallet to file an insurance claim.</p>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
                <p className="text-sm text-gray-300">
                  File a claim for a token that rugged. Claims are auto-evaluated based on risk score
                  changes — if the token dropped 40+ points or hit rug-tier, claims are auto-approved.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Token mint" value={claimMint} onChange={e => setClaimMint(e.target.value.trim())}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                  <input placeholder="Symbol" value={claimSymbol} onChange={e => setClaimSymbol(e.target.value)}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                  <input type="number" placeholder="Loss estimate (USD)" value={claimLoss} onChange={e => setClaimLoss(e.target.value)}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                  <input type="number" placeholder="Risk score when you bought (0-100)" value={claimEntryScore} onChange={e => setClaimEntryScore(e.target.value)}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                </div>
                <button onClick={doClaim} disabled={claiming}
                  className="px-6 py-3 bg-sentinel-danger hover:bg-sentinel-danger/80 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 w-full">
                  {claiming ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>

              {claimError && (
                <div className="p-3 rounded-xl border border-sentinel-danger/30 bg-sentinel-danger/5 text-sm text-sentinel-danger">{claimError}</div>
              )}

              {claimResult && (
                <div className={`p-4 rounded-xl border space-y-2 ${
                  claimResult.status === 'approved' ? 'border-green-500/40 bg-green-500/5' :
                  claimResult.status === 'denied' ? 'border-red-500/40 bg-red-500/5' :
                  'border-yellow-500/40 bg-yellow-500/5'
                }`}>
                  <div className="flex items-center gap-2">
                    {statusBadge(claimResult.status)}
                    <span className="text-sm font-bold text-white">{claimResult.tokenSymbol}</span>
                  </div>
                  <p className="text-xs text-gray-300">{claimResult.reason}</p>
                  <p className="text-[10px] text-gray-500">{claimResult.evidence}</p>
                  <div className="flex gap-4 text-xs text-gray-400 pt-1">
                    <span>Loss: ${claimResult.lossEstimateUsd.toFixed(0)}</span>
                    <span>Score: {claimResult.riskScoreAtEntry} → {claimResult.riskScoreNow}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── History Tab ─── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {!connectedWallet ? (
            <p className="text-sm text-gray-500">Connect wallet to see your claims.</p>
          ) : myClaims.length === 0 ? (
            <p className="text-sm text-gray-500">No claims filed yet.</p>
          ) : (
            myClaims.map(claim => (
              <div key={claim.id} className="p-3 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusBadge(claim.status)}
                    <span className="text-sm font-bold text-white">{claim.tokenSymbol}</span>
                  </div>
                  <span className="text-sm font-bold text-sentinel-danger">${claim.lossEstimateUsd.toFixed(0)}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{claim.reason}</p>
                <div className="flex gap-4 text-[10px] text-gray-600 mt-1">
                  <span>Score: {claim.riskScoreAtEntry} → {claim.riskScoreNow}</span>
                  <span>{new Date(claim.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
