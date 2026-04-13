import type { RiskScore, TokenFeedItem, FeeSnapshot, ApiResponse } from '../../shared/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://sentinel-api.apiworkersdev.workers.dev';
const BASE = `${API_URL}/v1`;

export async function fetchRiskScore(mint: string): Promise<RiskScore> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/risk/${mint}`);
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
  const body: ApiResponse<RiskScore> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Unknown error');
  return body.data;
}

export async function fetchTokenFeed(): Promise<TokenFeedItem[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/tokens/feed`);
  } catch {
    return [];
  }
  const body: ApiResponse<TokenFeedItem[]> = await res.json();
  if (!body.ok || !body.data) return [];
  return body.data;
}

export async function fetchFeeSnapshot(wallet: string): Promise<FeeSnapshot> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/fees/${wallet}`);
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
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
  let res: Response;
  try {
    res = await fetch(`${BASE}/fees/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, tokenMint }),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
  const body: ApiResponse<ClaimTxData> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Failed to build claim transactions');
  return body.data;
}

export interface ApiStats {
  totalRequests: number;
  byEndpoint: { risk: number; fees: number; claim: number; feed: number };
  today: { date: string; total: number; risk: number; fees: number; claim: number; feed: number };
  yesterday: { date: string; total: number };
}

export async function fetchApiStats(): Promise<ApiStats | null> {
  try {
    const res = await fetch(`${API_URL}/stats`);
    const body: ApiResponse<ApiStats> = await res.json();
    return body.ok && body.data ? body.data : null;
  } catch {
    return null;
  }
}

// ── Token Launch ─────────────────────────────────────────

export interface TokenInfoResult {
  tokenMint: string;
  metadataUrl: string;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export async function createTokenInfo(params: CreateTokenParams): Promise<TokenInfoResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
  const body: ApiResponse<TokenInfoResult> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Failed to create token');
  return body.data;
}

export interface FeeClaimerEntry {
  user: string;
  userBps: number;
}

export interface FeeConfigResult {
  needsCreation: boolean;
  transactions: Array<{ tx: string; blockhash: string; lastValidBlockHeight: number }>;
  meteoraConfigKey: string;
}

export async function createFeeConfig(feeClaimers: FeeClaimerEntry[], payer: string): Promise<FeeConfigResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/token/fee-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeClaimers, payer }),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
  const body: ApiResponse<FeeConfigResult> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Failed to create fee config');
  return body.data;
}

export interface LaunchTxResult {
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function createLaunchTransaction(params: {
  tokenMint: string;
  launchWallet: string;
  metadataUrl: string;
  configKey: string;
  initialBuyLamports: number;
}): Promise<LaunchTxResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/token/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'fetch failed'}`);
  }
  const body: ApiResponse<LaunchTxResult> = await res.json();
  if (!body.ok || !body.data) throw new Error(body.error ?? 'Failed to create launch transaction');
  return body.data;
}
