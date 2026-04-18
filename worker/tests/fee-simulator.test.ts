import { describe, it, expect } from 'vitest';
import { simulateFeeShare } from '../src/fees/simulator';
import type { FeeSimulationInput } from '../../shared/types';

const BASE_INPUT: FeeSimulationInput = {
  expectedDailyVolumeUsd: 50_000,
  feeRateBps: 100, // 1%
  allocations: [
    { label: 'Creator', bps: 4000 },
    { label: 'Holders', bps: 3000 },
    { label: 'Dev Fund', bps: 2000 },
    { label: 'Partner', bps: 1000 },
  ],
};

describe('simulateFeeShare', () => {
  it('calculates correct daily fees (1% of 50K = $500)', () => {
    const r = simulateFeeShare(BASE_INPUT);
    expect(r.dailyFeesUsd).toBe(500);
  });

  it('weekly = daily * 7', () => {
    const r = simulateFeeShare(BASE_INPUT);
    expect(r.weeklyFeesUsd).toBe(3500);
  });

  it('monthly = daily * 30', () => {
    const r = simulateFeeShare(BASE_INPUT);
    expect(r.monthlyFeesUsd).toBe(15000);
  });

  it('yearly = daily * 365', () => {
    const r = simulateFeeShare(BASE_INPUT);
    expect(r.yearlyFeesUsd).toBe(182500);
  });

  it('splits per-recipient by BPS', () => {
    const r = simulateFeeShare(BASE_INPUT);
    // Creator gets 40% of $500 = $200/day
    const creator = r.perRecipient.find((p) => p.label === 'Creator')!;
    expect(creator.dailyUsd).toBe(200);
    expect(creator.pctShare).toBe(40);
    // Partner gets 10% of $500 = $50/day
    const partner = r.perRecipient.find((p) => p.label === 'Partner')!;
    expect(partner.dailyUsd).toBe(50);
    expect(partner.pctShare).toBe(10);
  });

  it('compares to median daily volume (25K)', () => {
    const r = simulateFeeShare(BASE_INPUT);
    // (50K - 25K) / 25K * 100 = 100%
    expect(r.comparisonToMedian.yourVsMedianPct).toBe(100);
    expect(r.comparisonToMedian.medianDailyVolumeUsd).toBe(25_000);
  });

  it('negative comparison when below median', () => {
    const r = simulateFeeShare({ ...BASE_INPUT, expectedDailyVolumeUsd: 10_000 });
    // (10K - 25K) / 25K * 100 = -60%
    expect(r.comparisonToMedian.yourVsMedianPct).toBe(-60);
  });

  it('handles zero volume gracefully', () => {
    const r = simulateFeeShare({ ...BASE_INPUT, expectedDailyVolumeUsd: 0 });
    expect(r.dailyFeesUsd).toBe(0);
    expect(r.weeklyFeesUsd).toBe(0);
    expect(r.perRecipient.every((p) => p.dailyUsd === 0)).toBe(true);
  });

  it('handles single allocation', () => {
    const r = simulateFeeShare({
      expectedDailyVolumeUsd: 100_000,
      feeRateBps: 50, // 0.5%
      allocations: [{ label: 'Solo', bps: 10_000 }],
    });
    expect(r.dailyFeesUsd).toBe(500);
    expect(r.perRecipient).toHaveLength(1);
    expect(r.perRecipient[0].dailyUsd).toBe(500);
    expect(r.perRecipient[0].pctShare).toBe(100);
  });

  it('rounds to 2 decimal places', () => {
    const r = simulateFeeShare({
      expectedDailyVolumeUsd: 33_333,
      feeRateBps: 33,
      allocations: [{ label: 'A', bps: 3333 }, { label: 'B', bps: 6667 }],
    });
    // daily = 33333 * 33 / 10000 = 110.0
    const decimals = (n: number) => (n.toString().split('.')[1] || '').length;
    expect(decimals(r.dailyFeesUsd)).toBeLessThanOrEqual(2);
    r.perRecipient.forEach((p) => {
      expect(decimals(p.dailyUsd)).toBeLessThanOrEqual(2);
      expect(decimals(p.monthlyUsd)).toBeLessThanOrEqual(2);
    });
  });
});
