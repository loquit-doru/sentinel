/**
 * Wallet X-Ray — fetch all SPL token holdings for a wallet
 * and compute risk scores for each one.
 */

import type { RiskBreakdown } from '../../../shared/types';
import { HELIUS_RPC_BASE } from '../../../shared/constants';
import { computeRiskScore, type EngineEnv } from '../risk/engine';

export interface WalletHolding {
  mint: string;
  amount: number;       // raw token amount (UI units)
  decimals: number;
}

export interface XRayToken {
  mint: string;
  amount: number;
  decimals: number;
  score: number | null;   // 0-100 or null if scoring failed
  tier: string | null;
  breakdown: RiskBreakdown | null;
}

export interface XRayResult {
  wallet: string;
  holdings: XRayToken[];
  portfolioHealth: number;   // weighted-average score
  flaggedCount: number;      // tokens with score < 40
  scannedAt: number;
}

/** Fetch all SPL token accounts for a wallet via Helius RPC */
async function fetchWalletTokens(
  wallet: string,
  apiKey: string,
): Promise<WalletHolding[]> {
  const res = await fetch(`${HELIUS_RPC_BASE}/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'wallet-xray',
      method: 'getTokenAccountsByOwner',
      params: [
        wallet,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`Helius wallet scan ${res.status}`);
    return [];
  }

  const json = await res.json() as {
    result?: {
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                mint: string;
                tokenAmount: {
                  uiAmount: number;
                  decimals: number;
                  amount: string;
                };
              };
            };
          };
        };
      }>;
    };
  };

  if (!json.result?.value) return [];

  return json.result.value
    .map((v) => {
      const info = v.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
      };
    })
    .filter((h) => h.amount > 0); // only non-zero balances
}

/** Scan wallet: get holdings + risk scores */
export async function scanWallet(
  wallet: string,
  env: EngineEnv & { HELIUS_API_KEY?: string },
  kv?: KVNamespace,
): Promise<XRayResult> {
  if (!env.HELIUS_API_KEY) {
    return { wallet, holdings: [], portfolioHealth: 0, flaggedCount: 0, scannedAt: Date.now() };
  }

  const holdings = await fetchWalletTokens(wallet, env.HELIUS_API_KEY);

  // Score up to 20 tokens concurrently (avoid hitting rate limits)
  const toScore = holdings.slice(0, 20);

  const scored = await Promise.all(
    toScore.map(async (h): Promise<XRayToken> => {
      try {
        // Check KV cache first
        if (kv) {
          const cached = await kv.get(`risk:${h.mint}`, 'json') as { score: number; tier: string; breakdown: RiskBreakdown } | null;
          if (cached) {
            return { mint: h.mint, amount: h.amount, decimals: h.decimals, score: cached.score, tier: cached.tier, breakdown: cached.breakdown };
          }
        }

        const risk = await computeRiskScore(h.mint, env);

        // Cache for future use
        if (kv) {
          kv.put(`risk:${h.mint}`, JSON.stringify(risk), { expirationTtl: 60 }).catch(() => {});
        }

        return { mint: h.mint, amount: h.amount, decimals: h.decimals, score: risk.score, tier: risk.tier, breakdown: risk.breakdown };
      } catch {
        return { mint: h.mint, amount: h.amount, decimals: h.decimals, score: null, tier: null, breakdown: null };
      }
    }),
  );

  // Calculate portfolio health (average of scored tokens)
  const validScores = scored.filter((t) => t.score !== null) as (XRayToken & { score: number })[];
  const portfolioHealth = validScores.length > 0
    ? Math.round(validScores.reduce((s, t) => s + t.score, 0) / validScores.length)
    : 0;
  const flaggedCount = validScores.filter((t) => t.score < 40).length;

  return {
    wallet,
    holdings: scored,
    portfolioHealth,
    flaggedCount,
    scannedAt: Date.now(),
  };
}
