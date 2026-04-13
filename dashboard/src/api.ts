import type { RiskScore, TokenFeedItem, FeeSnapshot, ApiResponse } from '../../shared/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://sentinel-api.apiworkersdev.workers.dev';
const BASE = `${API_URL}/v1`;

export async function fetchRiskScore(mint: string): Promise<RiskScore> {
  const res = await fetch(`${BASE}/risk/${mint}`);
  const body: ApiResponse<RiskScore> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Unknown error');
  return body.data;
}

export async function fetchTokenFeed(): Promise<TokenFeedItem[]> {
  const res = await fetch(`${BASE}/tokens/feed`);
  const body: ApiResponse<TokenFeedItem[]> = await res.json();
  if (!body.ok || !body.data) return [];
  return body.data;
}

export async function fetchFeeSnapshot(wallet: string): Promise<FeeSnapshot> {
  const res = await fetch(`${BASE}/fees/${wallet}`);
  const body: ApiResponse<FeeSnapshot> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Unknown error');
  return body.data;
}

export interface ClaimTxData {
  transactions: Array<{
    tx: string;  // base58
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
}

export async function fetchClaimTransactions(wallet: string, tokenMint: string): Promise<ClaimTxData> {
  const res = await fetch(`${BASE}/fees/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, tokenMint }),
  });
  const body: ApiResponse<ClaimTxData> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Failed to build claim transactions');
  return body.data;
}
