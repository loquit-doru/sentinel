import { RISK_WEIGHTS } from '../../../shared/constants';
import type { RiskScore, RiskBreakdown } from '../../../shared/types';
import { tierFromScore } from '../../../shared/types';
import { fetchRugCheckReport, analyzeRugCheck } from './rugcheck';
import { fetchBirdeyeOverview, analyzeBirdeye } from './birdeye';
import { fetchTopHolders, analyzeHeliusHolders } from './helius';

export interface EngineEnv {
  HELIUS_API_KEY?: string;
  BIRDEYE_API_KEY?: string;
}

export async function computeRiskScore(
  mint: string,
  env: EngineEnv,
): Promise<RiskScore> {
  // Fetch all sources in parallel
  // Note: Birdeye token_security requires paid plan (401 on free tier),
  // and the 401 triggers rate limiting on subsequent requests.
  // We get security data from RugCheck instead.
  const [rugReport, birdOverview, heliusHolders] = await Promise.all([
    fetchRugCheckReport(mint),
    env.BIRDEYE_API_KEY
      ? fetchBirdeyeOverview(mint, env.BIRDEYE_API_KEY)
      : Promise.resolve(null),
    env.HELIUS_API_KEY
      ? fetchTopHolders(mint, env.HELIUS_API_KEY)
      : Promise.resolve([]),
  ]);

  // Analyze each source
  const rug = rugReport ? analyzeRugCheck(rugReport) : null;
  const bird = analyzeBirdeye(null, birdOverview);
  const helius = analyzeHeliusHolders(heliusHolders);

  // Build breakdown from best available data
  const breakdown: RiskBreakdown = {
    honeypot: rug?.honeypot ?? 50,
    lpLocked: rug?.lpLocked ?? 50,
    mintAuthority: rug?.mintAuthority ?? 50,
    freezeAuthority: rug?.freezeAuthority ?? 50,
    topHolderPct: rug?.topHolderPct ?? helius.topHolderConcentration,
    liquidityDepth: bird.liquidityDepth,
    volumeHealth: bird.volumeHealth,
    creatorReputation: rug?.creatorReputation ?? 50,
  };

  // Instant rug flag override
  if (rug?.ruggedFlag) {
    return {
      mint,
      score: 0,
      tier: 'rug',
      breakdown: { ...breakdown, honeypot: 0 },
      timestamp: Date.now(),
      cached: false,
    };
  }

  // Weighted score calculation
  const score = Math.round(
    breakdown.honeypot * RISK_WEIGHTS.honeypot +
    breakdown.lpLocked * RISK_WEIGHTS.lpLocked +
    breakdown.mintAuthority * RISK_WEIGHTS.mintAuthority +
    breakdown.freezeAuthority * RISK_WEIGHTS.freezeAuthority +
    breakdown.topHolderPct * RISK_WEIGHTS.topHolderPct +
    breakdown.liquidityDepth * RISK_WEIGHTS.liquidityDepth +
    breakdown.volumeHealth * RISK_WEIGHTS.volumeHealth +
    breakdown.creatorReputation * RISK_WEIGHTS.creatorReputation
  );

  return {
    mint,
    score,
    tier: tierFromScore(score),
    breakdown,
    timestamp: Date.now(),
    cached: false,
  };
}
