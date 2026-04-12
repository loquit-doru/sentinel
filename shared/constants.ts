// ── External API URLs ────────────────────────────────────

export const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
export const RUGCHECK_API_BASE = 'https://api.rugcheck.xyz/v1';
export const BIRDEYE_API_BASE = 'https://public-api.birdeye.so';
export const HELIUS_RPC_BASE = 'https://mainnet.helius-rpc.com';

// ── Risk Scoring Weights ─────────────────────────────────

export const RISK_WEIGHTS = {
  honeypot: 0.20,
  lpLocked: 0.15,
  mintAuthority: 0.15,
  freezeAuthority: 0.10,
  topHolderPct: 0.15,
  liquidityDepth: 0.10,
  volumeHealth: 0.10,
  creatorReputation: 0.05,
} as const satisfies Record<string, number>;

// ── Cache TTLs (seconds) ─────────────────────────────────

export const RISK_CACHE_TTL = 60;       // 1 min
export const FEED_CACHE_TTL = 30;       // 30 sec
export const FEE_CACHE_TTL = 300;       // 5 min

// ── Risk Tier Thresholds ─────────────────────────────────

export const TIER_SAFE_MIN = 70;
export const TIER_CAUTION_MIN = 40;
export const TIER_DANGER_MIN = 10;
// Below TIER_DANGER_MIN = rug

// ── Bags SDK ─────────────────────────────────────────────

export const BAGS_RATE_LIMIT = 1000;    // req/hour
export const HELIUS_FREE_CREDITS = 50_000; // per month
