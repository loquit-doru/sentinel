import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  // KV
  // RISK_CACHE: KVNamespace;
  // D1
  // DB: D1Database;
  // Secrets
  // RUGCHECK_API_URL: string;
  // HELIUS_API_KEY: string;
  // BIRDEYE_API_KEY: string;
  // BAGS_API_KEY: string;
  // TELEGRAM_BOT_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'sentinel-api', version: '0.1.0' });
});

// Risk score endpoint (stub)
app.get('/v1/risk/:mint', async (c) => {
  const mint = c.req.param('mint');
  // TODO W2: implement real scoring
  return c.json({
    mint,
    score: null,
    tier: null,
    message: 'Risk engine not yet implemented',
  }, 501);
});

// Fee positions endpoint (stub)
app.get('/v1/fees/:wallet', async (c) => {
  const wallet = c.req.param('wallet');
  // TODO W4: implement fee optimizer
  return c.json({
    wallet,
    claimable: [],
    totalClaimable: 0,
    message: 'Fee optimizer not yet implemented',
  }, 501);
});

// Token feed endpoint (stub)
app.get('/v1/tokens/feed', async (c) => {
  // TODO W1: implement via Bags SDK state
  return c.json({
    tokens: [],
    message: 'Token feed not yet implemented',
  }, 501);
});

export default app;
