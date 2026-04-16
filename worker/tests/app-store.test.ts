import { describe, it, expect } from 'vitest';
import { getAppStoreInfo, getSentFeeShareTarget } from '../src/app-store/info';

describe('getAppStoreInfo', () => {
  const info = getAppStoreInfo();

  it('returns correct name and tagline', () => {
    expect(info.name).toBe('Sentinel');
    expect(info.tagline).toBe("Don't trade blind.");
  });

  it('is categorized as AI Agents', () => {
    expect(info.category).toBe('AI Agents');
  });

  it('returns $SENT token info with valid mint', () => {
    expect(info.token.symbol).toBe('SENT');
    expect(info.token.mint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(info.token.bagsUrl).toContain(info.token.mint);
  });

  it('includes all required links', () => {
    expect(info.links.dashboard).toContain('http');
    expect(info.links.api).toContain('http');
    expect(info.links.github).toContain('github.com');
    expect(info.links.dorahacks).toContain('dorahacks.io');
  });

  it('has 10 features listed', () => {
    expect(info.features).toHaveLength(10);
    expect(info.features[0]).toContain('Risk Scoring');
  });

  it('has a valid semver-like version', () => {
    expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a valid date in updatedAt', () => {
    expect(info.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getSentFeeShareTarget', () => {
  const config = getSentFeeShareTarget();

  it('allocations sum to 100%', () => {
    const { creatorPct, holdersPct, devFundPct, partnerPct } = config.allocations;
    expect(creatorPct + holdersPct + devFundPct + partnerPct).toBe(100);
  });

  it('BPS values sum to 10000', () => {
    const totalBps = config.feeClaimers.reduce((s, fc) => s + fc.bps, 0);
    expect(totalBps).toBe(10_000);
  });

  it('has 4 fee claimers', () => {
    expect(config.feeClaimers).toHaveLength(4);
  });

  it('BPS matches percentage (1% = 100 bps)', () => {
    expect(config.feeClaimers[0].bps).toBe(config.allocations.creatorPct * 100);
    expect(config.feeClaimers[1].bps).toBe(config.allocations.holdersPct * 100);
    expect(config.feeClaimers[2].bps).toBe(config.allocations.devFundPct * 100);
    expect(config.feeClaimers[3].bps).toBe(config.allocations.partnerPct * 100);
  });

  it('uses SENT token mint', () => {
    expect(config.tokenSymbol).toBe('SENT');
    expect(config.tokenMint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it('creator gets the largest share', () => {
    const { creatorPct, holdersPct, devFundPct, partnerPct } = config.allocations;
    expect(creatorPct).toBeGreaterThan(holdersPct);
    expect(creatorPct).toBeGreaterThan(devFundPct);
    expect(creatorPct).toBeGreaterThan(partnerPct);
  });
});
