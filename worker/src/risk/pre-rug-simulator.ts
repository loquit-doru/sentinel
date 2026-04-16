/**
 * Pre-Rug Simulator — "What if?" analysis for token risk scenarios.
 *
 * Takes a token mint, fetches current risk data, then simulates:
 * - LP pull, mint exploit, whale dump, freeze attack, slow rug, honeypot activation
 * Outputs probability, estimated loss, timeframe, and mitigations.
 */

import type { Env } from '../index';
import type {
  RugScenario,
  RugSimulationInput,
  RugSimulationResult,
  ScenarioResult,
  RiskBreakdown,
} from '../../../shared/types';
import { tierFromScore } from '../../../shared/types';
import { computeRiskScore } from './engine';
import { fetchRugCheckReport, analyzeRugCheck } from './rugcheck';

const SIM_CACHE_TTL = 300; // 5 min

const ALL_SCENARIOS: RugScenario[] = [
  'lp_pull', 'mint_exploit', 'whale_dump',
  'freeze_attack', 'slow_rug', 'honeypot_activate',
];

export async function simulateRug(
  input: RugSimulationInput,
  env: Env,
): Promise<RugSimulationResult> {
  const { mint, scenarios: requestedScenarios } = input;
  const kv = env.SENTINEL_KV;

  // Check cache
  const cacheKey = `sim:${mint}`;
  if (kv) {
    const cached = await kv.get(cacheKey, 'json') as RugSimulationResult | null;
    if (cached) return cached;
  }

  // Fetch risk data
  const [riskScore, report] = await Promise.all([
    computeRiskScore(mint, {
      HELIUS_API_KEY: env.HELIUS_API_KEY,
      BIRDEYE_API_KEY: env.BIRDEYE_API_KEY,
    }),
    fetchRugCheckReport(mint),
  ]);

  const analysis = report ? analyzeRugCheck(report) : null;
  const scenariosToRun = requestedScenarios ?? ALL_SCENARIOS;

  const results: ScenarioResult[] = scenariosToRun.map(scenario =>
    simulateScenario(scenario, riskScore.score, riskScore.breakdown, report, analysis),
  );

  const applicable = results.filter(r => r.applicable);
  const worstCase = applicable.length > 0
    ? applicable.sort((a, b) => b.estimatedLossPct - a.estimatedLossPct)[0]
    : null;

  const overallRisk = deriveOverallRisk(applicable);

  const result: RugSimulationResult = {
    mint,
    tokenSymbol: analysis?.meta?.symbol ?? 'UNKNOWN',
    currentScore: riskScore.score,
    currentTier: riskScore.tier,
    scenarios: results,
    worstCase,
    overallRisk,
    simulatedAt: Date.now(),
  };

  // Cache
  if (kv) {
    await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: SIM_CACHE_TTL }).catch(() => {});
  }

  return result;
}

function simulateScenario(
  scenario: RugScenario,
  currentScore: number,
  breakdown: RiskBreakdown,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
  analysis: ReturnType<typeof analyzeRugCheck> | null,
): ScenarioResult {
  switch (scenario) {
    case 'lp_pull':
      return simulateLpPull(analysis, report);
    case 'mint_exploit':
      return simulateMintExploit(analysis, report);
    case 'whale_dump':
      return simulateWhaleDump(analysis, report);
    case 'freeze_attack':
      return simulateFreezeAttack(analysis, report);
    case 'slow_rug':
      return simulateSlowRug(currentScore, analysis, report);
    case 'honeypot_activate':
      return simulateHoneypot(analysis, report);
  }
}

function simulateLpPull(
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  // LP pull is applicable if LP is not fully locked
  const lpLockedScore = analysis?.lpLocked ?? 0;
  const applicable = lpLockedScore < 90; // <90% locked = pull possible

  const markets = report?.markets ?? [];
  const hasMultipleMarkets = markets.length > 1;
  const lpLockedPct = markets.length > 0
    ? Math.max(...markets.map(m => m.lp?.lpLockedPct ?? 0))
    : 0;

  let probability: ScenarioResult['probability'] = 'low';
  let estimatedLossPct = 0;

  if (lpLockedPct < 10) {
    probability = 'critical';
    estimatedLossPct = 95;
  } else if (lpLockedPct < 30) {
    probability = 'high';
    estimatedLossPct = 80;
  } else if (lpLockedPct < 70) {
    probability = 'medium';
    estimatedLossPct = 50;
  } else {
    probability = 'low';
    estimatedLossPct = 15;
  }

  return {
    scenario: 'lp_pull',
    applicable,
    probability,
    estimatedLossPct: applicable ? estimatedLossPct : 0,
    estimatedTimeframe: 'instant',
    explanation: applicable
      ? `Only ${lpLockedPct.toFixed(0)}% of LP is locked. Creator can remove ${(100 - lpLockedPct).toFixed(0)}% of liquidity instantly, crashing the price.`
      : 'LP is >90% locked — LP pull is effectively prevented.',
    mitigations: applicable
      ? ['Check LP lock duration (some expire)', 'Set stop-loss or exit before lock expires', hasMultipleMarkets ? 'Token has multiple markets — diversified liquidity' : 'Only 1 market — single point of failure']
      : ['LP lock provides strong protection'],
  };
}

function simulateMintExploit(
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  const mintActive = !!report?.mintAuthority;
  const applicable = mintActive;

  return {
    scenario: 'mint_exploit',
    applicable,
    probability: mintActive ? 'high' : 'low',
    estimatedLossPct: mintActive ? 90 : 0,
    estimatedTimeframe: mintActive ? 'minutes' : 'instant',
    explanation: mintActive
      ? 'Mint authority is still active. Creator can mint unlimited tokens, flooding supply and destroying price.'
      : 'Mint authority is revoked — infinite mint is impossible.',
    mitigations: mintActive
      ? ['Exit position if mint authority is not revoked soon', 'Monitor on-chain for mint events', 'Demand creator revoke mint authority']
      : ['Mint authority revoked — safe from this vector'],
  };
}

function simulateWhaleDump(
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  const holders = report?.topHolders ?? [];
  const top1Pct = holders.length > 0 ? holders[0].pct : 0;
  const top5Pct = holders.slice(0, 5).reduce((sum, h) => sum + h.pct, 0);
  const applicable = top1Pct > 10 || top5Pct > 40;

  let probability: ScenarioResult['probability'] = 'low';
  let estimatedLossPct = 0;

  if (top1Pct > 50) {
    probability = 'critical';
    estimatedLossPct = 85;
  } else if (top1Pct > 30 || top5Pct > 60) {
    probability = 'high';
    estimatedLossPct = 70;
  } else if (top1Pct > 15 || top5Pct > 40) {
    probability = 'medium';
    estimatedLossPct = 45;
  } else {
    probability = 'low';
    estimatedLossPct = 15;
  }

  const insiderCount = holders.filter(h => h.insider).length;

  return {
    scenario: 'whale_dump',
    applicable,
    probability,
    estimatedLossPct: applicable ? estimatedLossPct : 0,
    estimatedTimeframe: applicable ? 'minutes' : 'hours',
    explanation: applicable
      ? `Top holder owns ${top1Pct.toFixed(1)}% of supply (top 5: ${top5Pct.toFixed(1)}%). A coordinated sell would crash price ${estimatedLossPct}%+.${insiderCount > 0 ? ` ${insiderCount} insider wallets detected.` : ''}`
      : 'Holder distribution is healthy — no single wallet dominates.',
    mitigations: applicable
      ? ['Monitor large holder wallet activity', 'Set tight stop-loss', 'Avoid tokens with >30% single-holder concentration']
      : ['Healthy distribution reduces dump risk'],
  };
}

function simulateFreezeAttack(
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  const freezeActive = !!report?.freezeAuthority;
  const applicable = freezeActive;

  return {
    scenario: 'freeze_attack',
    applicable,
    probability: freezeActive ? 'medium' : 'low',
    estimatedLossPct: freezeActive ? 100 : 0,
    estimatedTimeframe: freezeActive ? 'instant' : 'instant',
    explanation: freezeActive
      ? 'Freeze authority is active. Creator can freeze any holder\'s tokens, making them permanently untransferable.'
      : 'Freeze authority is revoked — tokens cannot be frozen.',
    mitigations: freezeActive
      ? ['This is one of the most dangerous flags', 'Exit immediately if freeze authority is not revoked', 'No technical mitigation exists once frozen']
      : ['Freeze authority revoked — safe from this vector'],
  };
}

function simulateSlowRug(
  currentScore: number,
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  // Slow rug: creator gradually sells creator balance or insiders slowly dump
  const creatorBalance = report?.creatorBalance ?? 0;
  const holders = report?.topHolders ?? [];
  const insiderPct = holders.filter(h => h.insider).reduce((sum, h) => sum + h.pct, 0);
  const applicable = creatorBalance > 0 || insiderPct > 10;

  let probability: ScenarioResult['probability'] = 'low';
  let estimatedLossPct = 0;

  if (insiderPct > 30 || creatorBalance > 0) {
    probability = 'high';
    estimatedLossPct = 60;
  } else if (insiderPct > 15) {
    probability = 'medium';
    estimatedLossPct = 35;
  } else {
    probability = 'low';
    estimatedLossPct = 15;
  }

  return {
    scenario: 'slow_rug',
    applicable,
    probability,
    estimatedLossPct: applicable ? estimatedLossPct : 0,
    estimatedTimeframe: 'days',
    explanation: applicable
      ? `Creator/insiders hold ${insiderPct.toFixed(1)}% of supply. Gradual selling pressure would drain value over days/weeks.`
      : 'No significant insider holdings detected.',
    mitigations: applicable
      ? ['Watch for increasing sell pressure from known wallets', 'Track volume anomalies (selling without news)', 'Set trailing stop-loss']
      : ['Low insider concentration reduces slow-rug risk'],
  };
}

function simulateHoneypot(
  analysis: ReturnType<typeof analyzeRugCheck> | null,
  report: Awaited<ReturnType<typeof fetchRugCheckReport>>,
): ScenarioResult {
  const risks = report?.risks ?? [];
  const honeypotRisks = risks.filter(r =>
    r.name?.toLowerCase().includes('honeypot') ||
    r.name?.toLowerCase().includes('sell') ||
    r.name?.toLowerCase().includes('transfer'),
  );
  const hasDangerHoneypot = honeypotRisks.some(r => r.level === 'danger');
  const hasWarnHoneypot = honeypotRisks.some(r => r.level === 'warn');
  const applicable = hasDangerHoneypot || hasWarnHoneypot;

  return {
    scenario: 'honeypot_activate',
    applicable,
    probability: hasDangerHoneypot ? 'critical' : hasWarnHoneypot ? 'high' : 'low',
    estimatedLossPct: hasDangerHoneypot ? 100 : hasWarnHoneypot ? 80 : 0,
    estimatedTimeframe: 'instant',
    explanation: applicable
      ? `Token has ${honeypotRisks.length} honeypot-related risk(s). Selling may be restricted or impossible — your tokens could be permanently trapped.`
      : 'No honeypot indicators detected in contract analysis.',
    mitigations: applicable
      ? ['DO NOT buy — this is the highest severity warning', 'If already holding, try a small test sell immediately', 'Report token to RugCheck community']
      : ['Contract appears clean from honeypot mechanisms'],
  };
}

function deriveOverallRisk(applicable: ScenarioResult[]): RugSimulationResult['overallRisk'] {
  if (applicable.length === 0) return 'low';
  const critCount = applicable.filter(r => r.probability === 'critical').length;
  const highCount = applicable.filter(r => r.probability === 'high').length;
  const medCount = applicable.filter(r => r.probability === 'medium').length;

  if (critCount >= 1) return 'critical';
  if (highCount >= 2) return 'critical';
  if (highCount >= 1) return 'high';
  if (medCount >= 2) return 'high';
  if (medCount >= 1) return 'medium';
  return 'low';
}
