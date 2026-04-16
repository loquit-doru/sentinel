import { computeRiskScore } from '../risk/engine';
import type {
  InsuranceCommitment,
  InsuranceClaim,
  InsuranceClaimStatus,
  InsurancePoolStats,
} from '../../../shared/types';

// ── KV Keys ──────────────────────────────────────────────

const poolStatsKey     = () => 'ins:pool:stats';
const commitmentsKey   = () => 'ins:pool:commitments';
const claimsKey        = () => 'ins:pool:claims';
const walletClaimsKey  = (wallet: string) => `ins:claims:${wallet}`;

// ── Commitment tiers ─────────────────────────────────────

function commitmentTier(amount: number): InsuranceCommitment['tier'] {
  if (amount >= 100_000) return 'whale-shield';
  if (amount >= 10_000) return 'guardian';
  return 'backer';
}

// ── Pool stats ───────────────────────────────────────────

export async function getPoolStats(kv: KVNamespace): Promise<InsurancePoolStats> {
  const raw = await kv.get(poolStatsKey());
  if (!raw) {
    return {
      totalCommittedSent: 0,
      totalCommittors: 0,
      totalClaimsPaid: 0,
      totalClaimsSubmitted: 0,
      pendingClaimsCount: 0,
      poolHealthPct: 100,
      lastUpdated: Date.now(),
    };
  }
  return JSON.parse(raw) as InsurancePoolStats;
}

async function savePoolStats(stats: InsurancePoolStats, kv: KVNamespace): Promise<void> {
  stats.lastUpdated = Date.now();
  await kv.put(poolStatsKey(), JSON.stringify(stats), { expirationTtl: 86400 * 365 });
}

// ── Commitments ──────────────────────────────────────────

export async function getCommitments(kv: KVNamespace): Promise<InsuranceCommitment[]> {
  const raw = await kv.get(commitmentsKey());
  return raw ? JSON.parse(raw) as InsuranceCommitment[] : [];
}

export async function commitToPool(
  wallet: string,
  amountSent: number,
  kv: KVNamespace,
): Promise<{ commitment: InsuranceCommitment; poolStats: InsurancePoolStats }> {
  if (amountSent <= 0) throw new Error('Amount must be positive');

  const commitments = await getCommitments(kv);
  const stats = await getPoolStats(kv);

  // Check if wallet already committed — add to existing
  const existing = commitments.find(c => c.wallet === wallet);
  if (existing) {
    existing.amountSent += amountSent;
    existing.tier = commitmentTier(existing.amountSent);
    existing.committedAt = Date.now();
  } else {
    commitments.push({
      wallet,
      amountSent,
      tier: commitmentTier(amountSent),
      committedAt: Date.now(),
    });
    stats.totalCommittors++;
  }

  stats.totalCommittedSent += amountSent;

  // Cap commitments list
  if (commitments.length > 1000) commitments.splice(0, commitments.length - 1000);

  await Promise.all([
    kv.put(commitmentsKey(), JSON.stringify(commitments), { expirationTtl: 86400 * 365 }),
    savePoolStats(stats, kv),
  ]);

  const commitment = existing ?? commitments[commitments.length - 1];
  return { commitment, poolStats: stats };
}

// ── Claims ───────────────────────────────────────────────

async function getAllClaims(kv: KVNamespace): Promise<InsuranceClaim[]> {
  const raw = await kv.get(claimsKey());
  return raw ? JSON.parse(raw) as InsuranceClaim[] : [];
}

async function saveClaims(claims: InsuranceClaim[], kv: KVNamespace): Promise<void> {
  if (claims.length > 500) claims.splice(0, claims.length - 500);
  await kv.put(claimsKey(), JSON.stringify(claims), { expirationTtl: 86400 * 365 });
}

export async function submitClaim(
  wallet: string,
  tokenMint: string,
  tokenSymbol: string,
  lossEstimateUsd: number,
  riskScoreAtEntry: number,
  env: { HELIUS_API_KEY?: string; BIRDEYE_API_KEY?: string; BAGS_API_KEY?: string; SENTINEL_KV?: KVNamespace },
): Promise<InsuranceClaim> {
  const kv = env.SENTINEL_KV;
  if (!kv) throw new Error('KV not configured');

  // Get current risk score to compare
  let riskScoreNow = 0;
  try {
    const risk = await computeRiskScore(tokenMint, env as Parameters<typeof computeRiskScore>[1]);
    riskScoreNow = risk.score;
  } catch {
    // If we can't score, assume worst case
    riskScoreNow = 0;
  }

  // Auto-evaluate claim
  const scoreDrop = riskScoreAtEntry - riskScoreNow;
  let status: InsuranceClaimStatus = 'pending';
  let reason = 'Claim submitted for review';
  let evidence = `Score at entry: ${riskScoreAtEntry}, Score now: ${riskScoreNow}, Drop: ${scoreDrop}`;

  if (riskScoreNow <= 9 && scoreDrop >= 30) {
    // Clear rug — auto-approve
    status = 'approved';
    reason = 'Auto-approved: token confirmed rugged (score dropped to rug-tier)';
    evidence += ' | Token confirmed in rug-tier with significant score drop';
  } else if (scoreDrop >= 40) {
    // Major drop — auto-approve
    status = 'approved';
    reason = 'Auto-approved: major risk score decline (40+ points)';
    evidence += ' | Significant risk deterioration detected';
  } else if (scoreDrop < 10) {
    // Minimal change — deny
    status = 'denied';
    reason = 'Denied: risk score has not significantly decreased';
    evidence += ' | Insufficient evidence of loss event';
  }

  const claim: InsuranceClaim = {
    id: `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    wallet,
    tokenMint,
    tokenSymbol,
    lossEstimateUsd,
    riskScoreAtEntry,
    riskScoreNow,
    status,
    reason,
    evidence,
    submittedAt: Date.now(),
    resolvedAt: status !== 'pending' ? Date.now() : undefined,
  };

  const claims = await getAllClaims(kv);
  claims.push(claim);

  // Update pool stats
  const stats = await getPoolStats(kv);
  stats.totalClaimsSubmitted++;
  if (status === 'approved') stats.totalClaimsPaid++;
  if (status === 'pending') stats.pendingClaimsCount++;

  // Pool health: 100% when no claims paid, decreasing as claims grow relative to committed
  stats.poolHealthPct = stats.totalCommittedSent > 0
    ? Math.max(0, Math.round(100 * (1 - (stats.totalClaimsPaid * 100 / stats.totalCommittedSent))))
    : 100;

  await Promise.all([
    saveClaims(claims, kv),
    savePoolStats(stats, kv),
  ]);

  // Also save per-wallet
  const walletRaw = await kv.get(walletClaimsKey(wallet));
  const walletClaims: InsuranceClaim[] = walletRaw ? JSON.parse(walletRaw) : [];
  walletClaims.push(claim);
  if (walletClaims.length > 50) walletClaims.splice(0, walletClaims.length - 50);
  await kv.put(walletClaimsKey(wallet), JSON.stringify(walletClaims), { expirationTtl: 86400 * 90 });

  return claim;
}

export async function getWalletClaims(
  wallet: string,
  kv: KVNamespace,
): Promise<InsuranceClaim[]> {
  const raw = await kv.get(walletClaimsKey(wallet));
  return raw ? JSON.parse(raw) as InsuranceClaim[] : [];
}

export async function getRecentClaims(kv: KVNamespace): Promise<InsuranceClaim[]> {
  const claims = await getAllClaims(kv);
  return claims.slice(-20).reverse();
}
