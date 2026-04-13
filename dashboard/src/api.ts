import type { RiskScore, TokenFeedItem, ApiResponse } from '../../shared/types';

const BASE = '/v1';

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
