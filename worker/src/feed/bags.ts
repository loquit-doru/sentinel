import type { TokenFeedItem } from '../../../shared/types';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

/** Raw Bags API response shape for top tokens by lifetime fees */
interface BagsLeaderboardItem {
  token: string;
  lifetimeFees: string;
  tokenInfo: {
    id: string;
    name: string;
    symbol: string;
    icon: string;
    decimals: number;
    fdv: number;
    mcap: number;
    usdPrice: number;
    liquidity: number;
    holderCount: number;
    stats24h?: {
      volume: number;
      priceChange: number;
      buyVolume: number;
      sellVolume: number;
      numTrades: number;
      numBuys: number;
      numSells: number;
      numTraders: number;
      numBuyTraders: number;
      numSellTraders: number;
    };
  } | null;
  creators: Array<{ address: string; percentage: number }> | null;
  tokenSupply: { amount: string; decimals: number; uiAmount: number } | null;
  tokenLatestPrice: { price: number; timestamp: number } | null;
}

export async function fetchTopTokens(apiKey?: string): Promise<TokenFeedItem[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(`${BAGS_API_BASE}/token-launch/top-tokens/lifetime-fees`, { headers });
  if (!res.ok) {
    console.error(`Bags API ${res.status}: ${res.statusText}`);
    return [];
  }

  const body = await res.json() as BagsLeaderboardItem[] | { success: false; error: string };

  // API may wrap errors in { success: false, error: "..." }
  if (!Array.isArray(body)) {
    console.error('Bags API error:', (body as { error: string }).error);
    return [];
  }

  return body
    .filter((item) => item.tokenInfo !== null)
    .map((item): TokenFeedItem => {
      const info = item.tokenInfo!;
      const stats = info.stats24h;
      return {
        mint: item.token,
        name: info.name,
        symbol: info.symbol,
        imageUrl: info.icon ?? '',
        createdAt: 0, // not available from this endpoint
        volume24h: stats?.volume ?? 0,
        fdv: info.fdv ?? 0,
        priceChangePct24h: stats?.priceChange ?? 0,
        riskScore: null, // enriched later
        riskTier: null,
        lifetimeFees: parseFloat(item.lifetimeFees) || 0,
      };
    });
}
