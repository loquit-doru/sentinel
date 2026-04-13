import type { HeliusTokenAccount } from './types';

export async function fetchTopHolders(
  mint: string,
  apiKey: string,
): Promise<HeliusTokenAccount[]> {
  try {
    const res = await fetch(`${HELIUS_RPC_BASE}/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'sentinel-holders',
        method: 'getTokenLargestAccounts',
        params: [mint],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Helius RPC ${res.status}`);
      return [];
    }
    const json = await res.json() as {
      result?: {
        value: Array<{
          address: string;
          amount: string;
          decimals: number;
          uiAmount: number;
        }>;
      };
    };
    return (json.result?.value ?? []).map((v) => ({
      address: v.address,
      amount: Number(v.amount),
      decimals: v.decimals,
      owner: '', // resolved separately if needed
    }));
  } catch (err) {
    console.error('Helius holder fetch error:', err);
    return [];
  }
}

export function analyzeHeliusHolders(holders: HeliusTokenAccount[]) {
  if (holders.length === 0) return { topHolderConcentration: 50 }; // neutral fallback

  const totalAmount = holders.reduce((sum, h) => sum + h.amount, 0);
  if (totalAmount === 0) return { topHolderConcentration: 50 };

  // Top 5 concentration
  const top5Amount = holders.slice(0, 5).reduce((sum, h) => sum + h.amount, 0);
  const top5Pct = (top5Amount / totalAmount) * 100;

  // Lower concentration = better, score 0-100
  return {
    topHolderConcentration: Math.max(0, 100 - top5Pct),
  };
}
