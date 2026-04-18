/**
 * Creator Reputation Profiler
 *
 * Given a creator wallet, aggregates all their tokens via Helius DAS searchAssets,
 * scores each one, and computes a reputation score.
 */

import type { Env } from '../index';
import type { CreatorProfile, CreatorToken, RiskTier } from '../../../shared/types';
import { tierFromScore } from '../../../shared/types';
import { HELIUS_RPC_BASE } from '../../../shared/constants';
import { computeRiskScore } from '../risk/engine';

const MAX_TOKENS_PER_CREATOR = 20;
const CREATOR_CACHE_TTL = 600; // 10 minutes

interface HeliusCreatorAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
  };
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
  const creatorTokens = await fetchCreatorTokens(wallet, env.HELIUS_API_KEY);

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
          rugged: riskScore.tier === 'rug',
          createdAt: 0,
          lifetimeFees: 0,
        };
        return ct;
      } catch {
        return {
          mint: t.mint,
          name: t.name,
          symbol: t.symbol,
          riskScore: 50,
          riskTier: tierFromScore(50) as RiskTier,
          rugged: false,
          createdAt: 0,
          lifetimeFees: 0,
        } satisfies CreatorToken;
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
 * Fetch fungible tokens created by a wallet using Helius DAS searchAssets.
 */
async function fetchCreatorTokens(
  wallet: string,
  apiKey: string | undefined,
): Promise<Array<{ mint: string; name: string; symbol: string }>> {
  if (!apiKey) return [];

  try {
    const res = await fetch(`${HELIUS_RPC_BASE}/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'sentinel-creator',
        method: 'searchAssets',
        params: {
          creatorAddress: wallet,
          tokenType: 'fungible',
          page: 1,
          limit: MAX_TOKENS_PER_CREATOR,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`Helius searchAssets returned ${res.status} for creator ${wallet}`);
      return [];
    }

    const json = await res.json() as { result?: { items?: HeliusCreatorAsset[] } };
    const items = json.result?.items ?? [];

    return items
      .filter((a): a is HeliusCreatorAsset & { id: string } => typeof a.id === 'string' && a.id.length >= 32)
      .map((a) => ({
        mint: a.id,
        name: a.content?.metadata?.name ?? 'Unknown',
        symbol: a.content?.metadata?.symbol ?? '???',
      }));
  } catch (err) {
    console.error('Helius creator search failed:', err);
    return [];
  }
}
