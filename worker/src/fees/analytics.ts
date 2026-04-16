import type {
  FeeRevenueAnalytics,
  FeePositionAnalytics,
  RiskTier,
  FeeUrgency,
} from '../../../shared/types';
import { fetchSmartFees } from './smart-fees';

interface AnalyticsEnv {
  HELIUS_API_KEY?: string;
  BIRDEYE_API_KEY?: string;
  BAGS_API_KEY?: string;
  SENTINEL_KV?: KVNamespace;
}

/**
 * Build fee revenue analytics for a wallet.
 * Combines smart-fee data with yield projections.
 */
export async function buildFeeAnalytics(
  wallet: string,
  env: AnalyticsEnv,
): Promise<FeeRevenueAnalytics> {
  const smart = await fetchSmartFees(wallet, env);

  if (smart.positions.length === 0) {
    return {
      wallet,
      positions: [],
      totalClaimableUsd: 0,
      totalDailyAccrualUsd: 0,
      projectedMonthlyUsd: 0,
      projectedYearlyUsd: 0,
      topEarner: null,
      riskAdjustedScore: 0,
      safePositionsPct: 0,
      analyzedAt: Date.now(),
    };
  }

  // Estimate daily accrual from claimable amounts.
  // Bags fees accumulate continuously; assume claimable represents ~7 days of accrual
  // (conservative heuristic — can't know exact accrual start without historical data).
  const ACCRUAL_DAYS_ESTIMATE = 7;

  let totalDailyAccrual = 0;
  let safeValueUsd = 0;
  let totalValueUsd = 0;

  const positions: FeePositionAnalytics[] = smart.positions.map((pos) => {
    const dailyAccrualUsd =
      pos.claimableUsd > 0 ? pos.claimableUsd / ACCRUAL_DAYS_ESTIMATE : null;

    if (dailyAccrualUsd) totalDailyAccrual += dailyAccrualUsd;
    totalValueUsd += pos.claimableUsd;
    if (pos.riskTier === 'safe') safeValueUsd += pos.claimableUsd;

    const estimatedApy = dailyAccrualUsd && pos.claimableUsd > 0.01
      ? (dailyAccrualUsd * 365) / (pos.claimableUsd * ACCRUAL_DAYS_ESTIMATE) * 100
      : null;

    return {
      tokenMint: pos.tokenMint,
      tokenName: pos.tokenName,
      tokenSymbol: pos.tokenSymbol,
      claimableUsd: pos.claimableUsd,
      riskScore: pos.riskScore,
      riskTier: pos.riskTier,
      urgency: pos.urgency,
      estimatedApy,
      dailyAccrualUsd,
    };
  });

  // Find top earner
  let topEarner: FeeRevenueAnalytics['topEarner'] = null;
  for (const p of positions) {
    if (p.dailyAccrualUsd && (!topEarner || p.dailyAccrualUsd > topEarner.dailyUsd)) {
      topEarner = { mint: p.tokenMint, symbol: p.tokenSymbol, dailyUsd: p.dailyAccrualUsd };
    }
  }

  // Risk-adjusted score: weighted average of risk scores by position value
  let weightedRisk = 0;
  let totalWeight = 0;
  for (const p of positions) {
    if (p.riskScore !== null && p.claimableUsd > 0) {
      weightedRisk += p.riskScore * p.claimableUsd;
      totalWeight += p.claimableUsd;
    }
  }
  const riskAdjustedScore = totalWeight > 0 ? Math.round(weightedRisk / totalWeight) : 0;
  const safePositionsPct = totalValueUsd > 0
    ? Math.round((safeValueUsd / totalValueUsd) * 100)
    : 0;

  return {
    wallet,
    positions,
    totalClaimableUsd: smart.totalClaimableUsd,
    totalDailyAccrualUsd: Math.round(totalDailyAccrual * 100) / 100,
    projectedMonthlyUsd: Math.round(totalDailyAccrual * 30 * 100) / 100,
    projectedYearlyUsd: Math.round(totalDailyAccrual * 365 * 100) / 100,
    topEarner,
    riskAdjustedScore,
    safePositionsPct,
    analyzedAt: Date.now(),
  };
}
