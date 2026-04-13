import type { FeeSnapshot, ClaimablePosition } from '../../../shared/types';
import { BAGS_API_BASE } from '../../../shared/constants';

/**
 * Raw shape returned by Bags claimable-positions API.
 * We only type the fields we actually need.
 */
interface BagsClaimableRaw {
  baseMint: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenIcon?: string;
  totalClaimableLamportsUserShare: string;   // lamports as string
  totalClaimableUsdUserShare?: number;
  isMigrated?: boolean;
  virtualPool?: string;
  feeType?: string;
}

interface BagsClaimableResponse {
  success: boolean;
  response: BagsClaimableRaw[];
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export async function fetchClaimablePositions(
  wallet: string,
  apiKey?: string,
): Promise<FeeSnapshot> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;

  const url = `${BAGS_API_BASE}/token-launch/claimable-positions?wallet=${wallet}`;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`Bags fees API ${res.status}: ${res.statusText}`);
    return { wallet, positions: [], totalClaimableUsd: 0, lastUpdated: Date.now() };
  }

  const body = await res.json() as BagsClaimableResponse;
  if (!body.success || !Array.isArray(body.response)) {
    console.error('Bags fees API: unexpected format');
    return { wallet, positions: [], totalClaimableUsd: 0, lastUpdated: Date.now() };
  }

  let totalClaimableUsd = 0;

  const positions: ClaimablePosition[] = body.response
    .filter((p) => {
      const lamports = parseInt(p.totalClaimableLamportsUserShare, 10);
      return !isNaN(lamports) && lamports > 0;
    })
    .map((p): ClaimablePosition => {
      const lamports = parseInt(p.totalClaimableLamportsUserShare, 10);
      const solAmount = lamports / LAMPORTS_PER_SOL;
      const usdAmount = p.totalClaimableUsdUserShare ?? 0;
      totalClaimableUsd += usdAmount;

      return {
        tokenMint: p.baseMint,
        tokenName: p.tokenName ?? 'Unknown',
        tokenSymbol: p.tokenSymbol ?? '???',
        claimableAmount: solAmount,
        claimableUsd: usdAmount,
        source: p.isMigrated ? 'fee-share-v2' : 'fee-share-v1',
      };
    });

  return {
    wallet,
    positions,
    totalClaimableUsd,
    lastUpdated: Date.now(),
  };
}

// ── Claim Transactions ───────────────────────────────────

interface BagsClaimTxRaw {
  tx: string; // base58-encoded unsigned transaction
  blockhash: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
}

export interface ClaimTxPayload {
  transactions: Array<{
    tx: string;  // base58
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
}

export async function fetchClaimTransactions(
  wallet: string,
  tokenMint: string,
  apiKey?: string,
): Promise<ClaimTxPayload> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(`${BAGS_API_BASE}/token-launch/claim-txs/v3`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ feeClaimer: wallet, tokenMint }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bags claim-txs ${res.status}: ${text}`);
  }

  const body = await res.json() as { success: boolean; response: BagsClaimTxRaw[] };
  if (!body.success || !Array.isArray(body.response)) {
    throw new Error('Bags claim-txs: unexpected response format');
  }

  return {
    transactions: body.response.map((item) => ({
      tx: item.tx,
      blockhash: item.blockhash.blockhash,
      lastValidBlockHeight: item.blockhash.lastValidBlockHeight,
    })),
  };
}
