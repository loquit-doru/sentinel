// ── Risk Scoring ──────────────────────────────────────────

export type RiskTier = 'safe' | 'caution' | 'danger' | 'rug';

export interface RiskBreakdown {
  honeypot: number;       // 0-100 (0 = definitely honeypot)
  lpLocked: number;       // 0-100 (100 = fully locked)
  mintAuthority: number;  // 0 or 100 (100 = revoked)
  freezeAuthority: number;// 0 or 100 (100 = revoked)
  topHolderPct: number;   // 0-100 (lower = better distribution)
  liquidityDepth: number; // 0-100 (higher = deeper)
  volumeHealth: number;   // 0-100 (organic volume patterns)
  creatorReputation: number; // 0-100 (based on Bags history)
}

export interface RiskScore {
  mint: string;
  score: number;          // 0-100 (higher = safer)
  tier: RiskTier;
  breakdown: RiskBreakdown;
  timestamp: number;      // Unix ms
  cached: boolean;
}

export function tierFromScore(score: number): RiskTier {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'caution';
  if (score >= 10) return 'danger';
  return 'rug';
}

// ── Fee Optimizer ────────────────────────────────────────

export interface ClaimablePosition {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  claimableAmount: number;  // in SOL or token units
  claimableUsd: number;
  source: 'fee-share-v1' | 'fee-share-v2' | 'partner';
}

export interface FeeSnapshot {
  wallet: string;
  positions: ClaimablePosition[];
  totalClaimableUsd: number;
  lastUpdated: number;     // Unix ms
}

// ── Token Feed ───────────────────────────────────────────

export interface TokenFeedItem {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  createdAt: number;       // Unix ms
  volume24h: number;       // USD
  fdv: number;             // USD
  priceChangePct24h: number;
  riskScore: number | null;
  riskTier: RiskTier | null;
  lifetimeFees: number;    // USD
}

// ── API Responses ────────────────────────────────────────

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
