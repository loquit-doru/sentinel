import { describe, it, expect } from 'vitest';
import {
  RISK_WEIGHTS,
  RISK_CACHE_TTL,
  FEED_CACHE_TTL,
  FEE_CACHE_TTL,
  TIER_SAFE_MIN,
  TIER_CAUTION_MIN,
  TIER_DANGER_MIN,
  SENT_MINT,
  BAGS_API_BASE,
  RUGCHECK_API_BASE,
  BIRDEYE_API_BASE,
  HELIUS_RPC_BASE,
} from '../../shared/constants';
import { tierFromScore } from '../../shared/types';
import type { RiskTier } from '../../shared/types';

// ── Tier thresholds consistency ─────────────────────────

describe('tier thresholds', () => {
  it('safe > caution > danger', () => {
    expect(TIER_SAFE_MIN).toBeGreaterThan(TIER_CAUTION_MIN);
    expect(TIER_CAUTION_MIN).toBeGreaterThan(TIER_DANGER_MIN);
  });

  it('tierFromScore matches TIER_ constants', () => {
    expect(tierFromScore(TIER_SAFE_MIN)).toBe('safe');
    expect(tierFromScore(TIER_SAFE_MIN - 1)).toBe('caution');
    expect(tierFromScore(TIER_CAUTION_MIN)).toBe('caution');
    expect(tierFromScore(TIER_CAUTION_MIN - 1)).toBe('danger');
    expect(tierFromScore(TIER_DANGER_MIN)).toBe('danger');
    expect(tierFromScore(TIER_DANGER_MIN - 1)).toBe('rug');
  });

  it('tierFromScore boundary: 0 is rug', () => {
    expect(tierFromScore(0)).toBe('rug');
  });

  it('tierFromScore boundary: 100 is safe', () => {
    expect(tierFromScore(100)).toBe('safe');
  });
});

// ── RISK_WEIGHTS invariants ─────────────────────────────

describe('RISK_WEIGHTS invariants', () => {
  it('all keys are lowercase camelCase', () => {
    for (const key of Object.keys(RISK_WEIGHTS)) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });

  it('no weight exceeds 0.5 (no single factor dominates)', () => {
    for (const [key, val] of Object.entries(RISK_WEIGHTS)) {
      expect(val, `${key} should be ≤ 0.5`).toBeLessThanOrEqual(0.5);
    }
  });

  it('honeypot has the highest weight', () => {
    const max = Math.max(...Object.values(RISK_WEIGHTS));
    expect(RISK_WEIGHTS.honeypot).toBe(max);
  });
});

// ── Cache TTLs ──────────────────────────────────────────

describe('cache TTLs', () => {
  it('risk cache TTL is positive', () => {
    expect(RISK_CACHE_TTL).toBeGreaterThan(0);
  });

  it('feed cache is shorter than risk cache', () => {
    expect(FEED_CACHE_TTL).toBeLessThanOrEqual(RISK_CACHE_TTL);
  });

  it('fee cache is longer than risk cache (fees change less often)', () => {
    expect(FEE_CACHE_TTL).toBeGreaterThan(RISK_CACHE_TTL);
  });
});

// ── SENT token ──────────────────────────────────────────

describe('SENT token', () => {
  it('mint is a valid base58 Solana address', () => {
    expect(SENT_MINT).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it('mint ends with BAGS (Bags launcher convention)', () => {
    expect(SENT_MINT).toMatch(/BAGS$/);
  });
});

// ── External API base URLs ──────────────────────────────

describe('API base URLs', () => {
  it('all use HTTPS', () => {
    expect(BAGS_API_BASE).toMatch(/^https:\/\//);
    expect(RUGCHECK_API_BASE).toMatch(/^https:\/\//);
    expect(BIRDEYE_API_BASE).toMatch(/^https:\/\//);
    expect(HELIUS_RPC_BASE).toMatch(/^https:\/\//);
  });

  it('no trailing slashes', () => {
    expect(BAGS_API_BASE).not.toMatch(/\/$/);
    expect(RUGCHECK_API_BASE).not.toMatch(/\/$/);
    expect(BIRDEYE_API_BASE).not.toMatch(/\/$/);
    expect(HELIUS_RPC_BASE).not.toMatch(/\/$/);
  });
});
