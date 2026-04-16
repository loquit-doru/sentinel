import type { PendingClaim, SmartFeePosition } from '../../../shared/types';

const KV_PREFIX = 'claim:';
const CLAIM_TTL = 3600; // 1 hour

/** Generate a short unique ID (URL-safe) */
function generateClaimId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  // Base62-ish encoding using hex for simplicity + readability
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a pending claim from a smart fee scan result, store in KV */
export async function prepareClaim(
  wallet: string,
  positions: SmartFeePosition[],
  totalClaimableUsd: number,
  urgentClaimableUsd: number,
  criticalCount: number,
  kv: KVNamespace,
): Promise<PendingClaim> {
  const id = generateClaimId();
  const now = Date.now();

  const claim: PendingClaim = {
    id,
    wallet,
    positions,
    totalClaimableUsd,
    urgentClaimableUsd,
    criticalCount,
    createdAt: now,
    expiresAt: now + CLAIM_TTL * 1000,
    status: 'pending',
  };

  await kv.put(`${KV_PREFIX}${id}`, JSON.stringify(claim), {
    expirationTtl: CLAIM_TTL,
  });

  return claim;
}

/** Retrieve a pending claim by ID. Returns null if expired or not found. */
export async function getClaim(
  claimId: string,
  kv: KVNamespace,
): Promise<PendingClaim | null> {
  const raw = await kv.get(`${KV_PREFIX}${claimId}`, 'json');
  if (!raw) return null;

  const claim = raw as PendingClaim;

  // Mark expired if past TTL (KV auto-deletes, but belt-and-suspenders)
  if (Date.now() > claim.expiresAt) {
    return null;
  }

  return claim;
}

/** Mark a claim as completed */
export async function markClaimDone(
  claimId: string,
  kv: KVNamespace,
): Promise<void> {
  const claim = await getClaim(claimId, kv);
  if (!claim) return;

  claim.status = 'claimed';
  await kv.put(`${KV_PREFIX}${claimId}`, JSON.stringify(claim), {
    expirationTtl: 300, // keep 5 min after claimed (for status check)
  });
}
