import type { FeeSimulationInput, FeeSimulationResult } from '../../../shared/types';

/**
 * Median daily volume for Bags tokens — rough benchmark from top-100 tokens.
 * Used for comparison ("your token vs typical Bags token").
 */
const MEDIAN_DAILY_VOLUME_USD = 25_000;

/**
 * Simulate fee revenue for a hypothetical token launch.
 * Pure function — no external calls.
 */
export function simulateFeeShare(input: FeeSimulationInput): FeeSimulationResult {
  const { expectedDailyVolumeUsd, feeRateBps, allocations } = input;

  const dailyFeesUsd = (expectedDailyVolumeUsd * feeRateBps) / 10_000;
  const weeklyFeesUsd = dailyFeesUsd * 7;
  const monthlyFeesUsd = dailyFeesUsd * 30;
  const yearlyFeesUsd = dailyFeesUsd * 365;

  const perRecipient = allocations.map((a) => {
    const share = a.bps / 10_000;
    return {
      label: a.label,
      bps: a.bps,
      pctShare: Math.round(share * 10_000) / 100, // e.g. 40.00
      dailyUsd: Math.round(dailyFeesUsd * share * 100) / 100,
      monthlyUsd: Math.round(monthlyFeesUsd * share * 100) / 100,
      yearlyUsd: Math.round(yearlyFeesUsd * share * 100) / 100,
    };
  });

  const yourVsMedianPct =
    MEDIAN_DAILY_VOLUME_USD > 0
      ? Math.round(((expectedDailyVolumeUsd - MEDIAN_DAILY_VOLUME_USD) / MEDIAN_DAILY_VOLUME_USD) * 100)
      : 0;

  return {
    dailyFeesUsd: Math.round(dailyFeesUsd * 100) / 100,
    weeklyFeesUsd: Math.round(weeklyFeesUsd * 100) / 100,
    monthlyFeesUsd: Math.round(monthlyFeesUsd * 100) / 100,
    yearlyFeesUsd: Math.round(yearlyFeesUsd * 100) / 100,
    perRecipient,
    comparisonToMedian: {
      medianDailyVolumeUsd: MEDIAN_DAILY_VOLUME_USD,
      yourVsMedianPct,
    },
  };
}
