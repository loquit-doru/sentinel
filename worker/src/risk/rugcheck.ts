import type { RugCheckReport } from './types';

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

export async function fetchRugCheckReport(mint: string): Promise<RugCheckReport | null> {
  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mint}/report`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`RugCheck ${res.status} for ${mint}`);
      return null;
    }
    return await res.json() as RugCheckReport;
  } catch (err) {
    console.error('RugCheck fetch error:', err);
    return null;
  }
}

export function analyzeRugCheck(report: RugCheckReport) {
  // mintAuthority / freezeAuthority are at top level in full report
  // 100 = revoked (safe), 0 = still active (danger)
  const mintAuthority = !report.mintAuthority ? 100 : 0;
  const freezeAuthority = !report.freezeAuthority ? 100 : 0;

  // LP locked: aggregate across all markets (weighted by liquidity)
  const markets = report.markets ?? [];
  let totalLpLockedPct = 0;
  if (markets.length > 0) {
    // Use max lpLockedPct across markets as representative
    for (const m of markets) {
      const pct = m.lp?.lpLockedPct ?? 0;
      if (pct > totalLpLockedPct) totalLpLockedPct = pct;
    }
  }
  const lpLocked = Math.min(totalLpLockedPct, 100);

  // Honeypot: based on RugCheck risks
  const risks = report.risks ?? [];
  const dangerRisks = risks.filter(r => r.level === 'danger').length;
  const warnRisks = risks.filter(r => r.level === 'warn').length;
  const honeypot = Math.max(0, 100 - (dangerRisks * 30) - (warnRisks * 10));

  // Top holder concentration: lower = better distribution
  const holders = report.topHolders ?? [];
  const top5Pct = holders.slice(0, 5).reduce((sum, h) => sum + h.pct, 0);
  const topHolderPct = Math.max(0, 100 - top5Pct);

  const creatorReputation = report.rugged ? 0 : 50;

  return {
    mintAuthority,
    freezeAuthority,
    lpLocked,
    honeypot,
    topHolderPct,
    creatorReputation,
    meta: report.tokenMeta,
    ruggedFlag: report.rugged,
    rugcheckScore: report.score_normalised,
  };
}
