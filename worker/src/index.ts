import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { computeRiskScore } from './risk/engine';
import { fetchTopTokens } from './feed/bags';
import { fetchClaimablePositions, fetchClaimTransactions } from './fees/bags-fees';
import { createTokenInfo, createLaunchTransaction, createFeeShareConfig } from './token/launch';
import type { FeeClaimerEntry } from './token/launch';

export interface Env {
  // Secrets
  HELIUS_API_KEY?: string;
  BIRDEYE_API_KEY?: string;
  BAGS_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  // KV
  SENTINEL_KV?: KVNamespace;
}

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// ── Analytics middleware ──────────────────────────────────
// Fire-and-forget: track API usage in KV for traction metrics

app.use('/v1/*', async (c, next) => {
  await next();
  const kv = c.env.SENTINEL_KV;
  if (!kv) return;

  const path = new URL(c.req.url).pathname;
  const endpoint =
    path.startsWith('/v1/risk/') ? 'risk' :
    path.startsWith('/v1/fees/claim') ? 'claim' :
    path.startsWith('/v1/fees/') ? 'fees' :
    path.startsWith('/v1/tokens/') ? 'feed' : 'other';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  c.executionCtx.waitUntil(
    Promise.all([
      // Total hits per endpoint (all-time)
      kv.get(`stats:total:${endpoint}`).then((v) =>
        kv.put(`stats:total:${endpoint}`, String(Number(v || 0) + 1)),
      ),
      // Daily hits
      kv.get(`stats:day:${today}:${endpoint}`).then((v) =>
        kv.put(`stats:day:${today}:${endpoint}`, String(Number(v || 0) + 1), { expirationTtl: 86400 * 30 }),
      ),
      // Global daily total
      kv.get(`stats:day:${today}:total`).then((v) =>
        kv.put(`stats:day:${today}:total`, String(Number(v || 0) + 1), { expirationTtl: 86400 * 30 }),
      ),
    ]).catch(() => {}),
  );
});

// ── Health ───────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'sentinel-api',
    version: '0.1.0',
    pillars: ['risk-scoring', 'fee-optimizer'],
  });
});

// ── Public Stats ─────────────────────────────────────────

app.get('/stats', async (c) => {
  const kv = c.env.SENTINEL_KV;
  if (!kv) return c.json({ ok: false, error: 'KV not configured' }, 500);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const endpoints = ['risk', 'fees', 'claim', 'feed'] as const;

  const [totalRisk, totalFees, totalClaim, totalFeed, todayTotal, yesterdayTotal, ...dailyEndpoints] =
    await Promise.all([
      kv.get('stats:total:risk'),
      kv.get('stats:total:fees'),
      kv.get('stats:total:claim'),
      kv.get('stats:total:feed'),
      kv.get(`stats:day:${today}:total`),
      kv.get(`stats:day:${yesterday}:total`),
      ...endpoints.map((e) => kv.get(`stats:day:${today}:${e}`)),
    ]);

  const totalAll = [totalRisk, totalFees, totalClaim, totalFeed]
    .reduce((s, v) => s + Number(v || 0), 0);

  return c.json({
    ok: true,
    data: {
      totalRequests: totalAll,
      byEndpoint: {
        risk: Number(totalRisk || 0),
        fees: Number(totalFees || 0),
        claim: Number(totalClaim || 0),
        feed: Number(totalFeed || 0),
      },
      today: {
        date: today,
        total: Number(todayTotal || 0),
        risk: Number(dailyEndpoints[0] || 0),
        fees: Number(dailyEndpoints[1] || 0),
        claim: Number(dailyEndpoints[2] || 0),
        feed: Number(dailyEndpoints[3] || 0),
      },
      yesterday: {
        date: yesterday,
        total: Number(yesterdayTotal || 0),
      },
    },
  });
});

// ── Risk Score ───────────────────────────────────────────

app.get('/v1/risk/:mint', async (c) => {
  const mint = c.req.param('mint');

  if (!SOLANA_ADDR_RE.test(mint)) {
    return c.json({ ok: false, error: 'Invalid Solana mint address' }, 400);
  }

  const kv = c.env.SENTINEL_KV;

  // Check KV cache
  if (kv) {
    const cached = await kv.get(`risk:${mint}`, 'json');
    if (cached) {
      return c.json({ ok: true, data: { ...(cached as object), cached: true } }, 200, {
        'x-cache': 'HIT',
      });
    }
  }

  try {
    const score = await computeRiskScore(mint, {
      HELIUS_API_KEY: c.env.HELIUS_API_KEY,
      BIRDEYE_API_KEY: c.env.BIRDEYE_API_KEY,
    });

    // Store in KV cache (60s TTL)
    if (kv) {
      c.executionCtx.waitUntil(
        kv.put(`risk:${mint}`, JSON.stringify(score), { expirationTtl: 60 }),
      );
    }

    return c.json({ ok: true, data: score }, 200, { 'x-cache': 'MISS' });
  } catch (err) {
    console.error('Risk score error:', err);
    return c.json({ ok: false, error: 'Failed to compute risk score' }, 500);
  }
});

// ── Fee Positions ────────────────────────────────────────

app.get('/v1/fees/:wallet', async (c) => {
  const wallet = c.req.param('wallet');

  if (!SOLANA_ADDR_RE.test(wallet)) {
    return c.json({ ok: false, error: 'Invalid Solana wallet address' }, 400);
  }

  const kv = c.env.SENTINEL_KV;

  // Check KV cache (30s TTL)
  if (kv) {
    const cached = await kv.get(`fees:${wallet}`, 'json');
    if (cached) {
      return c.json({ ok: true, data: cached }, 200, { 'x-cache': 'HIT' });
    }
  }

  try {
    const snapshot = await fetchClaimablePositions(wallet, c.env.BAGS_API_KEY);

    if (kv) {
      c.executionCtx.waitUntil(
        kv.put(`fees:${wallet}`, JSON.stringify(snapshot), { expirationTtl: 30 }),
      );
    }

    return c.json({ ok: true, data: snapshot }, 200, { 'x-cache': 'MISS' });
  } catch (err) {
    console.error('Fee positions error:', err);
    return c.json({ ok: false, error: 'Failed to fetch fee positions' }, 500);
  }
});

// ── Claim Transactions ───────────────────────────────────

app.post('/v1/fees/claim', async (c) => {
  let body: { wallet?: string; tokenMint?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.wallet || !SOLANA_ADDR_RE.test(body.wallet)) {
    return c.json({ ok: false, error: 'Invalid wallet address' }, 400);
  }
  if (!body.tokenMint || !SOLANA_ADDR_RE.test(body.tokenMint)) {
    return c.json({ ok: false, error: 'Invalid token mint address' }, 400);
  }

  try {
    const payload = await fetchClaimTransactions(body.wallet, body.tokenMint, c.env.BAGS_API_KEY);
    return c.json({ ok: true, data: payload });
  } catch (err) {
    console.error('Claim tx error:', err);
    return c.json({ ok: false, error: 'Failed to build claim transactions' }, 500);
  }
});

// ── Token Launch: Create Metadata ────────────────────────

app.post('/v1/token/create', async (c) => {
  let body: {
    name?: string; symbol?: string; description?: string;
    imageUrl?: string; website?: string; twitter?: string; telegram?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.name || !body.symbol || !body.description || !body.imageUrl) {
    return c.json({ ok: false, error: 'Missing required fields: name, symbol, description, imageUrl' }, 400);
  }

  try {
    const result = await createTokenInfo(
      {
        name: body.name,
        symbol: body.symbol,
        description: body.description,
        imageUrl: body.imageUrl,
        website: body.website,
        twitter: body.twitter,
        telegram: body.telegram,
      },
      c.env.BAGS_API_KEY,
    );
    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error('Token create error:', err);
    return c.json({ ok: false, error: 'Failed to create token metadata' }, 500);
  }
});

// ── Token Launch: Fee-Share Config ───────────────────────

app.post('/v1/token/fee-config', async (c) => {
  let body: {
    feeClaimers?: FeeClaimerEntry[];
    payer?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.payer || !SOLANA_ADDR_RE.test(body.payer)) {
    return c.json({ ok: false, error: 'Invalid payer wallet address' }, 400);
  }
  if (!Array.isArray(body.feeClaimers) || body.feeClaimers.length === 0) {
    return c.json({ ok: false, error: 'feeClaimers array required (wallet + bps entries)' }, 400);
  }

  // Validate total bps = 10000 (use Math.round to avoid floating-point drift)
  const totalBps = Math.round(body.feeClaimers.reduce((s, e) => s + (e.userBps || 0), 0));
  if (totalBps !== 10_000) {
    return c.json({ ok: false, error: `Fee shares must total 10000 bps (100%), got ${totalBps}` }, 400);
  }

  try {
    const result = await createFeeShareConfig(
      { feeClaimers: body.feeClaimers, payer: body.payer },
      c.env.BAGS_API_KEY,
    );
    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error('Fee config error:', err);
    return c.json({ ok: false, error: 'Failed to create fee-share config' }, 500);
  }
});

// ── Token Launch: Launch Transaction ─────────────────────

app.post('/v1/token/launch', async (c) => {
  let body: {
    tokenMint?: string; launchWallet?: string; metadataUrl?: string;
    configKey?: string; initialBuyLamports?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.tokenMint || !SOLANA_ADDR_RE.test(body.tokenMint)) {
    return c.json({ ok: false, error: 'Invalid tokenMint' }, 400);
  }
  if (!body.launchWallet || !SOLANA_ADDR_RE.test(body.launchWallet)) {
    return c.json({ ok: false, error: 'Invalid launchWallet' }, 400);
  }
  if (!body.metadataUrl || !body.configKey) {
    return c.json({ ok: false, error: 'Missing metadataUrl or configKey' }, 400);
  }

  try {
    const result = await createLaunchTransaction(
      {
        tokenMint: body.tokenMint,
        launchWallet: body.launchWallet,
        metadataUrl: body.metadataUrl,
        configKey: body.configKey,
        initialBuyLamports: body.initialBuyLamports ?? 0,
      },
      c.env.BAGS_API_KEY,
    );
    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error('Launch tx error:', err);
    return c.json({ ok: false, error: 'Failed to create launch transaction' }, 500);
  }
});

// ── Token Feed ───────────────────────────────────────────

app.get('/v1/tokens/feed', async (c) => {
  const kv = c.env.SENTINEL_KV;

  // Check KV cache (30s TTL for feed)
  if (kv) {
    const cached = await kv.get('feed:top', 'json');
    if (cached) {
      return c.json({ ok: true, data: cached }, 200, { 'x-cache': 'HIT' });
    }
  }

  try {
    const tokens = await fetchTopTokens(c.env.BAGS_API_KEY);

    if (kv) {
      c.executionCtx.waitUntil(
        kv.put('feed:top', JSON.stringify(tokens), { expirationTtl: 30 }),
      );
    }

    return c.json({ ok: true, data: tokens }, 200, { 'x-cache': 'MISS' });
  } catch (err) {
    console.error('Token feed error:', err);
    return c.json({ ok: false, error: 'Failed to fetch token feed' }, 500);
  }
});

export default app;
