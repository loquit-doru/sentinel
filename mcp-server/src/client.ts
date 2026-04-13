/**
 * Sentinel API Client for MCP Server
 * Calls the deployed Sentinel Worker API via HTTP.
 */

export interface SentinelClientOptions {
  baseUrl: string;
}

export interface RiskScore {
  mint: string;
  score: number;
  tier: 'safe' | 'caution' | 'danger' | 'rug';
  breakdown: {
    honeypot: number;
    lpLocked: number;
    mintAuthority: number;
    freezeAuthority: number;
    topHolderPct: number;
    liquidityDepth: number;
    volumeHealth: number;
    creatorReputation: number;
  };
  timestamp: number;
  cached: boolean;
}

export interface TokenFeedItem {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  volume24h: number;
  fdv: number;
  priceChangePct24h: number;
  riskScore: number | null;
  riskTier: string | null;
  lifetimeFees: number;
}

export interface ClaimablePosition {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  claimableAmount: number;
  claimableUsd: number;
}

export interface FeeSnapshot {
  wallet: string;
  positions: ClaimablePosition[];
  totalClaimableUsd: number;
}

export class SentinelClient {
  private baseUrl: string;

  constructor(options: SentinelClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    const data = await response.json();
    // Worker returns { ok, data, error } wrapper
    if (data && typeof data === 'object' && 'ok' in data) {
      if (!data.ok) throw new Error(data.error || 'API error');
      return data.data as T;
    }
    return data as T;
  }

  /** Get risk score (0-100) for a Solana token mint */
  async getRiskScore(mint: string): Promise<RiskScore> {
    return this.request<RiskScore>(`/v1/risk/${encodeURIComponent(mint)}`);
  }

  /** Get top tokens by lifetime fees on Bags */
  async getTokenFeed(): Promise<TokenFeedItem[]> {
    return this.request<TokenFeedItem[]>('/v1/tokens/feed');
  }

  /** Get claimable fee positions for a wallet */
  async getClaimableFees(wallet: string): Promise<FeeSnapshot> {
    return this.request<FeeSnapshot>(`/v1/fees/${encodeURIComponent(wallet)}`);
  }
}
