import { BAGS_API_BASE } from '../../../shared/constants';

// ── Types ────────────────────────────────────────────────

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;      // lamports or smallest unit
  outputAmount: string;
  priceImpactPct: number;
  slippageMode: 'dynamic' | 'fixed';
  route: string;             // route description
}

export interface SwapTxPayload {
  transactions: Array<{
    tx: string;               // base58 serialized
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
}

// ── Wrapped SOL mint ─────────────────────────────────────
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// ── Get swap quote ───────────────────────────────────────

export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;          // lamports
  slippageMode?: 'dynamic' | 'fixed';
  slippageBps?: number;
}, bagsApiKey?: string): Promise<SwapQuote> {

  const url = new URL(`${BAGS_API_BASE}/trade/quote`);
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', String(params.amount));
  url.searchParams.set('slippageMode', params.slippageMode ?? 'dynamic');
  if (params.slippageBps) {
    url.searchParams.set('slippageBps', String(params.slippageBps));
  }

  const headers: Record<string, string> = {};
  if (bagsApiKey) headers['x-api-key'] = bagsApiKey;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bags quote API ${res.status}: ${text}`);
  }

  const body = await res.json() as { success: boolean; response: Record<string, unknown> };
  if (!body.success) {
    throw new Error('Bags quote API returned success=false');
  }

  const r = body.response;
  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inputAmount: String(params.amount),
    outputAmount: String(r.outAmount ?? r.outputAmount ?? '0'),
    priceImpactPct: Number(r.priceImpactPct ?? 0),
    slippageMode: params.slippageMode ?? 'dynamic',
    route: String(r.routePlan ? 'Meteora' : r.route ?? 'Bags'),
  };
}

// ── Build swap transaction ───────────────────────────────

export async function buildSwapTransaction(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  walletAddress: string;
  slippageMode?: 'dynamic' | 'fixed';
  slippageBps?: number;
}, bagsApiKey?: string): Promise<SwapTxPayload> {

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (bagsApiKey) headers['x-api-key'] = bagsApiKey;

  const res = await fetch(`${BAGS_API_BASE}/trade/swap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      walletAddress: params.walletAddress,
      slippageMode: params.slippageMode ?? 'dynamic',
      slippageBps: params.slippageBps,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bags swap API ${res.status}: ${text}`);
  }

  const body = await res.json() as { success: boolean; response: Record<string, unknown> };
  if (!body.success) {
    throw new Error('Bags swap API returned success=false');
  }

  const r = body.response;

  // Bags may return a single tx or array
  const txArray = Array.isArray(r.transactions)
    ? r.transactions as Array<{ tx: string; blockhash: string; lastValidBlockHeight: number }>
    : r.transaction
      ? [{ tx: String(r.transaction), blockhash: String(r.blockhash ?? ''), lastValidBlockHeight: Number(r.lastValidBlockHeight ?? 0) }]
      : [];

  if (txArray.length === 0) {
    throw new Error('No transactions returned from swap API');
  }

  return { transactions: txArray };
}
