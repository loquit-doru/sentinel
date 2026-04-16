import { describe, it, expect } from 'vitest';
import { tierFromScore } from '../../shared/types';
import { RISK_WEIGHTS } from '../../shared/constants';

// ── tierFromScore ───────────────────────────────────────

describe('tierFromScore', () => {
  it('returns safe for score >= 70', () => {
    expect(tierFromScore(70)).toBe('safe');
    expect(tierFromScore(85)).toBe('safe');
    expect(tierFromScore(100)).toBe('safe');
  });

  it('returns caution for score 40-69', () => {
    expect(tierFromScore(40)).toBe('caution');
    expect(tierFromScore(55)).toBe('caution');
    expect(tierFromScore(69)).toBe('caution');
  });

  it('returns danger for score 10-39', () => {
    expect(tierFromScore(10)).toBe('danger');
    expect(tierFromScore(25)).toBe('danger');
    expect(tierFromScore(39)).toBe('danger');
  });

  it('returns rug for score < 10', () => {
    expect(tierFromScore(0)).toBe('rug');
    expect(tierFromScore(5)).toBe('rug');
    expect(tierFromScore(9)).toBe('rug');
  });
});

// ── RISK_WEIGHTS ────────────────────────────────────────

describe('RISK_WEIGHTS', () => {
  it('sums to exactly 1.0', () => {
    const total = Object.values(RISK_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it('has exactly 8 weight categories', () => {
    expect(Object.keys(RISK_WEIGHTS)).toHaveLength(8);
  });

  it('all weights are positive', () => {
    for (const [key, val] of Object.entries(RISK_WEIGHTS)) {
      expect(val, `${key} should be > 0`).toBeGreaterThan(0);
    }
  });

  it('produces max score 100 when all breakdown values are 100', () => {
    const score = Math.round(
      100 * RISK_WEIGHTS.honeypot +
      100 * RISK_WEIGHTS.lpLocked +
      100 * RISK_WEIGHTS.mintAuthority +
      100 * RISK_WEIGHTS.freezeAuthority +
      100 * RISK_WEIGHTS.topHolderPct +
      100 * RISK_WEIGHTS.liquidityDepth +
      100 * RISK_WEIGHTS.volumeHealth +
      100 * RISK_WEIGHTS.creatorReputation,
    );
    expect(score).toBe(100);
  });

  it('produces score 0 when all breakdown values are 0', () => {
    const score = Math.round(
      0 * RISK_WEIGHTS.honeypot +
      0 * RISK_WEIGHTS.lpLocked +
      0 * RISK_WEIGHTS.mintAuthority +
      0 * RISK_WEIGHTS.freezeAuthority +
      0 * RISK_WEIGHTS.topHolderPct +
      0 * RISK_WEIGHTS.liquidityDepth +
      0 * RISK_WEIGHTS.volumeHealth +
      0 * RISK_WEIGHTS.creatorReputation,
    );
    expect(score).toBe(0);
  });
});
