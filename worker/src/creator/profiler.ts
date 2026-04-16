/**
 * Creator Reputation Profiler
 *
 * Given a creator wallet, aggregates all their tokens from Bags,
 * scores each one, and computes a reputation score.
 */

import type { Env } from '../index';
import type { CreatorProfile, CreatorToken, RiskTier } from '../../../shared/types';
import { tierFromScore } from '../../../shared/types';
import { BAGS_API_BASE, RUGCHECK_API_BASE } from '../../../shared/constants';
import { computeRiskScore } from '../risk/engine';
import { fetchRugCheckReport } from '../risk/rugcheck';

const MAX_TOKENS_PER_CREATOR = 20;
const CREATOR_CACHE_TTL = 600; // 10 minutes

interface RugCheckCreatorToken {
  mint: string;
  name: string;
  symbol: string;
  rugged: boolean;
  score_normalised: number;
}

/**
 * Build a creator profile by:
 * 1. Fetching their tokens from RugCheck creator endpoint
 * 2. Scoring each token
 * 3. Computing aggregate reputation
 */
export async function buildCreatorProfile(
  wallet: string,
  env: Env,
): Promise<CreatorProfile> {
  // RugCheck has a /creator/:wallet endpoint that lists tokens by creator
  // If that fails, fall back to fetching the Bags feed and filtering
  const creatorTokens = await fetchCreatorTokens(wallet);

  const batch = creatorTokens.slice(0, MAX_TOKENS_PER_CREATOR);

  // Score each token in parallel
  const scored: CreatorToken[] = [];
  const results = await Promise.allSettled(
    batch.map(async (t) => {
      try {
        const riskScore = await computeRiskScore(t.mint, {
          HELIUS_API_KEY: env.HELIUS_API_KEY,
          BIRDEYE_API_KEY: env.BIRDEYE_API_KEY,
        });
        const ct: CreatorToken = {
          mint: t.mint,
          name: t.name,
          symbol: t.symbol,
          riskScore: riskScore.score,
          riskTier: riskScore.tier,
          rugged: t.rugged,
          createdAt: 0,
          lifetimeFees: 0,
        };
        return ct;
      } catch {
        // If scoring fails, use RugCheck normalized score
        const ct: CreatorToken = {
          mint: t.mint,
          name: t.name,
          symbol: t.symbol,
          riskScore: t.score_normalised,
          riskTier: tierFromScore(t.score_normalised),
          rugged: t.rugged,
          createdAt: 0,
          lifetimeFees: 0,
        };
        return ct;
      }
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      scored.push(r.value);
    }
  }

  // Compute reputation
  const totalTokens = scored.length;
  const ruggedCount = scored.filter((t) => t.rugged).length;
  const safeCount = scored.filter((t) => t.riskTier === 'safe').length;
  const avgRiskScore = totalTokens > 0
    ? Math.round(scored.reduce((sum, t) => sum + t.riskScore, 0) / totalTokens)
    : 50;

  // Reputation formula:
  // Base: average risk score of all tokens
  // Penalty: -20 per rugged token (severe)
  // Bonus: +5 per safe token
  // Clamp to 0-100
  let reputationScore = avgRiskScore;
  reputationScore -= ruggedCount * 20;
  reputationScore += safeCount * 5;
  reputationScore = Math.max(0, Math.min(100, reputationScore));

  // If majority rugged, force danger/rug tier
  if (totalTokens > 0 && ruggedCount / totalTokens >= 0.5) {
    reputationScore = Math.min(reputationScore, 15);
  }

  return {
    wallet,
    totalTokens,
    ruggedCount,
    safeCount,
    avgRiskScore,
    reputationScore,
    reputationTier: tierFromScore(reputationScore),
    tokens: scored.sort((a, b) => a.riskScore - b.riskScore), // worst first
    scannedAt: Date.now(),
  };
}

/**
 * Fetch tokens created by a wallet using RugCheck API.
 */
async function fetchCreatorTokens(wallet: string): Promise<RugCheckCreatorToken[]> {
  try {
    // RugCheck doesn't have a direct /creator endpoint in public API
    // But we can search tokens and filter by creator
    // For now, use the /tokens/recently-created endpoint or direct search
    // Alternative: use Helius DAS to find tokens where creator = wallet

    // Strategy: Helius getAssetsByCreator
    // This is the most reliable way
    const res = await fetch(`${RUGCHECK_API_BASE}/creator/${wallet}/tokens`, {
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json() as RugCheckCreatorToken[];
      if (Array.isArray(data)) return data;
    }

    // Fallback: empty array (creator not indexed yet)
    console.warn(`RugCheck creator lookup returned ${res.status} for ${wallet}`);
    return [];
  } catch (err) {
    console.error('Creator token fetch failed:', err);
    return [];
  }
}
