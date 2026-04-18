import { computeRiskScore } from '../risk/engine';
import { checkTokenGate } from '../gate/token-gate';
import { SENT_MINT, INSURANCE_POOL_WALLET } from '../../../shared/constants';
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

// ── On-chain tx verification ─────────────────────────────

async function verifyInsuranceTx(
  txSignature: string,
  expectedSender: string,
  expectedAmount: number,
  heliusApiKey: string,
): Promise<{ verified: boolean; error?: string }> {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }),
  });
  const data = await res.json() as { result?: { meta?: { err: unknown }; transaction?: { message?: { accountKeys?: Array<{ pubkey: string }>; instructions?: Array<{ parsed?: { type?: string; info?: { authority?: string; destination?: string; amount?: string; mint?: string } } }> } } } };
  if (!data.result) return { verified: false, error: 'Transaction not found on-chain' };
  if (data.result.meta?.err) return { verified: false, error: 'Transaction failed on-chain' };

  // Parse SPL token transfer instructions
  const instructions = data.result.transaction?.message?.instructions ?? [];
  for (const ix of instructions) {
    const parsed = ix.parsed;
    if (!parsed) continue;
    if (parsed.type === 'transferChecked' || parsed.type === 'transfer') {
      const info = parsed.info;
      if (!info) continue;
      // Verify sender authority matches expected wallet
      if (info.authority !== expectedSender) continue;
      // Verify the mint is $SENT (only available on transferChecked)
      if (parsed.type === 'transferChecked' && info.mint && info.mint !== SENT_MINT) continue;
      // Amount is in raw token units — $SENT uses 9 decimals on Bags
      const rawAmount = Number(info.amount ?? '0');
      if (rawAmount > 0) {
        return { verified: true };
      }
    }
  }

  return { verified: false, error: 'No valid $SENT transfer found in transaction' };
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
  heliusApiKey?: string,
  txSignature?: string,
): Promise<{ commitment: InsuranceCommitment; poolStats: InsurancePoolStats }> {
  if (amountSent <= 0) throw new Error('Amount must be positive');

  // Require on-chain tx signature
  if (!txSignature) throw new Error('Transaction signature required — commit $SENT on-chain first');
  if (!heliusApiKey) throw new Error('Helius API key not configured');

  // Replay prevention: check if this tx was already used
  const txKey = `ins:tx:${txSignature}`;
  const usedTx = await kv.get(txKey);
  if (usedTx) throw new Error('Transaction already used for a commitment');

  // Verify the transaction on-chain
  const verification = await verifyInsuranceTx(txSignature, wallet, amountSent, heliusApiKey);
  if (!verification.verified) {
    throw new Error(verification.error ?? 'Transaction verification failed');
  }

  // Mark tx as used (replay prevention)
  await kv.put(txKey, wallet, { expirationTtl: 86400 * 365 });

  // Verify the wallet actually holds $SENT before accepting a commitment
  const gate = await checkTokenGate(wallet, heliusApiKey ?? '', kv);
  if (gate.tier === 'free') {
    throw new Error('Must hold $SENT to commit to the insurance pool');
  }

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
      txSignature,
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
