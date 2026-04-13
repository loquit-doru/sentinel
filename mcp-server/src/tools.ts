/**
 * MCP Tool definitions and handlers for Sentinel
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { SentinelClient } from './client.js';

export const tools = [
  {
    name: 'get_risk_score',
    description: `Get the AI risk score (0-100) for any Solana token on Bags.fm.

Analyzes 8 weighted signals from 4 data sources:
- Honeypot risks (20%) — from RugCheck
- LP Lock status (15%) — from RugCheck
- Mint Authority (15%) — revoked = safe
- Freeze Authority (10%) — revoked = safe
- Top Holder concentration (15%) — from Helius DAS
- Liquidity depth (10%) — from Birdeye
- Volume health (10%) — from Birdeye
- Creator reputation (5%) — from Bags SDK

Returns a score with tier classification:
- 🟢 Safe (70-100): Low risk, fundamentals solid
- 🟡 Caution (40-69): Some flags, investigate further
- 🔴 Danger (10-39): Multiple red flags
- ⛔ Rug (0-9): Extremely high risk

Use this tool when a user asks about token safety, rug risk, or whether a token is safe to trade.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        mint: {
          type: 'string',
          description: 'Solana token mint address (base58). Example: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 (BONK)',
        },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_trending_tokens',
    description: `Get trending tokens on Bags.fm, ranked by lifetime fees generated.

Returns a list of tokens with: name, symbol, mint address, 24h volume, FDV, price change, lifetime fees, and risk score (if available).

Use this when a user asks about trending tokens, popular tokens on Bags, or what's hot in the market.`,
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_claimable_fees',
    description: `Check unclaimed creator fees for a Solana wallet on Bags.fm.

Returns all token positions with claimable fees, including per-position amounts and total USD value.

Use this when a user asks about their unclaimed fees, fee earnings, or wants to know how much they can claim.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        wallet: {
          type: 'string',
          description: 'Solana wallet address (base58) to check for claimable fees',
        },
      },
      required: ['wallet'],
    },
  },
  {
    name: 'compare_tokens',
    description: `Compare risk scores of multiple Solana tokens side by side.

Fetches risk scores for 2-5 tokens and presents them in a comparison table. Useful for evaluating which token is safer to trade or invest in.

Use this when a user asks to compare tokens, asks "which is safer", or wants to evaluate multiple options.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        mints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of 2-5 Solana token mint addresses to compare',
          minItems: 2,
          maxItems: 5,
        },
      },
      required: ['mints'],
    },
  },
];

export async function handleToolCall(
  client: SentinelClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case 'get_risk_score': {
      const mint = args.mint as string;
      if (!mint) throw new McpError(ErrorCode.InvalidParams, 'mint is required');
      const score = await client.getRiskScore(mint);
      return {
        mint: score.mint,
        score: score.score,
        tier: score.tier,
        breakdown: score.breakdown,
        summary: `${score.tier.toUpperCase()} (${score.score}/100)`,
        cached: score.cached,
      };
    }

    case 'get_trending_tokens': {
      const tokens = await client.getTokenFeed();
      return {
        count: tokens.length,
        tokens: tokens.slice(0, 20).map((t) => ({
          name: t.name,
          symbol: t.symbol,
          mint: t.mint,
          volume24h: `$${t.volume24h.toLocaleString()}`,
          fdv: `$${t.fdv.toLocaleString()}`,
          priceChange24h: `${t.priceChangePct24h > 0 ? '+' : ''}${t.priceChangePct24h.toFixed(1)}%`,
          lifetimeFees: `$${t.lifetimeFees.toLocaleString()}`,
          riskScore: t.riskScore,
          riskTier: t.riskTier,
        })),
      };
    }

    case 'get_claimable_fees': {
      const wallet = args.wallet as string;
      if (!wallet) throw new McpError(ErrorCode.InvalidParams, 'wallet is required');
      const snapshot = await client.getClaimableFees(wallet);
      return {
        wallet: snapshot.wallet,
        totalClaimableUsd: `$${snapshot.totalClaimableUsd.toFixed(2)}`,
        positionCount: snapshot.positions.length,
        positions: snapshot.positions.map((p) => ({
          token: `${p.tokenName} (${p.tokenSymbol})`,
          mint: p.tokenMint,
          claimable: `$${p.claimableUsd.toFixed(2)}`,
        })),
      };
    }

    case 'compare_tokens': {
      const mints = args.mints as string[];
      if (!mints || mints.length < 2) {
        throw new McpError(ErrorCode.InvalidParams, 'mints must contain at least 2 addresses');
      }
      if (mints.length > 5) {
        throw new McpError(ErrorCode.InvalidParams, 'mints must contain at most 5 addresses');
      }

      const results = await Promise.allSettled(
        mints.map((m) => client.getRiskScore(m)),
      );

      const comparison = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          const s = r.value;
          return {
            mint: s.mint,
            score: s.score,
            tier: s.tier,
            breakdown: s.breakdown,
          };
        }
        return { mint: mints[i], error: 'Failed to fetch risk score' };
      });

      const safest = comparison
        .filter((c): c is typeof c & { score: number } => 'score' in c)
        .sort((a, b) => b.score - a.score)[0];

      return {
        comparison,
        recommendation: safest
          ? `Safest token: ${safest.mint} (score ${safest.score}/100, ${safest.tier})`
          : 'Could not determine safest token',
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }
}
