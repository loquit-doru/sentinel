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

// ── Smart Fee Intelligence ───────────────────────────────

export type FeeUrgency = 'critical' | 'warning' | 'safe' | 'unknown';

export interface SmartFeePosition extends ClaimablePosition {
  riskScore: number | null;     // 0-100
  riskTier: RiskTier | null;
  urgency: FeeUrgency;
  urgencyReason: string;        // human-readable reason
}

export interface SmartFeeSnapshot {
  wallet: string;
  positions: SmartFeePosition[];
  totalClaimableUsd: number;
  urgentClaimableUsd: number;   // only critical + warning
  criticalCount: number;
  lastUpdated: number;
}

// ── Wallet Monitoring ────────────────────────────────────

export interface MonitoredWallet {
  wallet: string;
  telegramChatId?: string;      // optional Telegram destination
  autoClaimThresholdUsd: number; // notify/auto-claim when above this
  registeredAt: number;          // Unix ms
  lastNotifiedAt: number;        // Unix ms (0 = never)
  lastClaimableUsd: number;      // last known amount
}

// ── Pending Claims (AutoClaim) ───────────────────────────

export interface PendingClaim {
  id: string;                    // unique claim ID (nanoid)
  wallet: string;                // creator wallet
  positions: SmartFeePosition[]; // positions to claim
  totalClaimableUsd: number;
  urgentClaimableUsd: number;
  criticalCount: number;
  createdAt: number;             // Unix ms
  expiresAt: number;             // Unix ms (1h TTL)
  status: 'pending' | 'claimed' | 'expired';
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

// ── Risk Alerts ──────────────────────────────────────────

export type AlertType =
  | 'tier_change'        // token moved from safe→caution, caution→danger, etc.
  | 'lp_unlock'          // LP was locked, now unlocked
  | 'lp_drain'           // LP liquidity actively draining (rug in progress)
  | 'holder_spike'       // top holder concentration jumped significantly
  | 'mint_authority'     // mint authority was NOT revoked (or was re-enabled)
  | 'new_danger'         // new token scored danger/rug on first scan
  | 'creator_rug_history'; // creator has history of rugged tokens

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RiskAlert {
  id: string;               // unique alert ID
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;             // "BONK dropped from SAFE to DANGER"
  description: string;       // detailed explanation
  previousScore: number | null;
  currentScore: number;
  previousTier: RiskTier | null;
  currentTier: RiskTier;
  timestamp: number;         // Unix ms
  creatorWallet: string | null;
  // LP drain specific fields
  liquidityUsd?: number;       // current liquidity in USD
  prevLiquidityUsd?: number;   // previous liquidity in USD
  liquidityDropPct?: number;   // % drop since last scan
}

export interface AlertFeed {
  alerts: RiskAlert[];
  scannedTokens: number;
  lastScanAt: number;       // Unix ms
}

// ── Creator Reputation ───────────────────────────────────

export interface CreatorToken {
  mint: string;
  name: string;
  symbol: string;
  riskScore: number;
  riskTier: RiskTier;
  rugged: boolean;
  createdAt: number;         // Unix ms (0 if unknown)
  lifetimeFees: number;
}

export interface CreatorProfile {
  wallet: string;
  totalTokens: number;
  ruggedCount: number;
  safeCount: number;
  avgRiskScore: number;
  reputationScore: number;   // 0-100 (higher = more trustworthy)
  reputationTier: RiskTier;
  tokens: CreatorToken[];
  scannedAt: number;         // Unix ms
}

// ── Leaderboard ──────────────────────────────────────────

export interface LeaderboardEntry {
  wallet: string;
  displayName: string | null;   // optional alias
  scansPerformed: number;
  rugsDetected: number;
  shareCount: number;
  portfolioHealth: number | null; // latest health score
  rank: number;
  sentBalance: number;           // $SENT held
  tier: 'free' | 'holder' | 'whale';
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalUsers: number;
  period: 'weekly' | 'alltime';
  updatedAt: number;             // Unix ms
}

// ── Fee Revenue Analytics ────────────────────────────────

export interface FeePositionAnalytics {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  claimableUsd: number;
  riskScore: number | null;
  riskTier: RiskTier | null;
  urgency: FeeUrgency;
  /** Annualized yield estimate based on recent fee accrual vs token FDV */
  estimatedApy: number | null;
  /** Fee accrual velocity — USD per day estimate */
  dailyAccrualUsd: number | null;
}

export interface FeeRevenueAnalytics {
  wallet: string;
  positions: FeePositionAnalytics[];
  totalClaimableUsd: number;
  totalDailyAccrualUsd: number;
  projectedMonthlyUsd: number;
  projectedYearlyUsd: number;
  topEarner: { mint: string; symbol: string; dailyUsd: number } | null;
  riskAdjustedScore: number;       // 0-100 (weighted by safe vs risky positions)
  safePositionsPct: number;        // % of value in safe-tier tokens
  analyzedAt: number;
}

// ── Fee-Share Simulator ──────────────────────────────────

export interface FeeSimulationInput {
  /** Expected daily volume in USD */
  expectedDailyVolumeUsd: number;
  /** Fee rate in basis points (e.g. 100 = 1%) */
  feeRateBps: number;
  /** Allocation splits — must sum to 10000 */
  allocations: Array<{ label: string; bps: number }>;
}

export interface FeeSimulationResult {
  dailyFeesUsd: number;
  weeklyFeesUsd: number;
  monthlyFeesUsd: number;
  yearlyFeesUsd: number;
  perRecipient: Array<{
    label: string;
    bps: number;
    pctShare: number;
    dailyUsd: number;
    monthlyUsd: number;
    yearlyUsd: number;
  }>;
  comparisonToMedian: {
    medianDailyVolumeUsd: number;
    yourVsMedianPct: number;
  };
}

// ── Autonomous Firewall ──────────────────────────────────

export type FirewallDecision = 'ALLOW' | 'WARN' | 'BLOCK';

export interface FirewallRule {
  id: string;
  tokenMint: string;
  tokenSymbol?: string;
  action: 'whitelist' | 'block';
  reason?: string;
  createdAt: number;
}

export interface FirewallScreenResult {
  decision: FirewallDecision;
  riskScore: number;
  riskTier: RiskTier;
  reasons: string[];
  rulesApplied: string[];
  estimatedRiskUsd: number;
  screenedAt: number;
}

export interface FirewallWalletConfig {
  wallet: string;
  rules: FirewallRule[];
  autoBlockRug: boolean;
  autoBlockDanger: boolean;
  autoBlockLpDrain: boolean;
  updatedAt: number;
}

export interface FirewallStats {
  totalScreened: number;
  totalBlocked: number;
  totalWarned: number;
  estimatedSavedUsd: number;
  topBlockedTokens: Array<{ mint: string; symbol: string; count: number }>;
  updatedAt: number;
}

export interface FirewallLogEntry {
  wallet: string;
  tokenMint: string;
  tokenSymbol: string;
  decision: FirewallDecision;
  riskScore: number;
  riskTier: RiskTier;
  amountUsd: number;
  reasons: string[];
  screenedAt: number;
}

// ── Insurance Pool ───────────────────────────────────────

export type InsuranceClaimStatus = 'pending' | 'approved' | 'denied';

export interface InsuranceCommitment {
  wallet: string;
  amountSent: number;
  tier: 'backer' | 'guardian' | 'whale-shield';
  committedAt: number;
}

export interface InsuranceClaim {
  id: string;
  wallet: string;
  tokenMint: string;
  tokenSymbol: string;
  lossEstimateUsd: number;
  riskScoreAtEntry: number;
  riskScoreNow: number;
  status: InsuranceClaimStatus;
  reason: string;
  evidence: string;
  submittedAt: number;
  resolvedAt?: number;
}

export interface InsurancePoolStats {
  totalCommittedSent: number;
  totalCommittors: number;
  totalClaimsPaid: number;
  totalClaimsSubmitted: number;
  pendingClaimsCount: number;
  poolHealthPct: number;
  lastUpdated: number;
}
