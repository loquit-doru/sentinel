/**
 * scan-top-tokens.ts
 *
 * Operational script: fetches the Bags leaderboard via Sentinel's own /v1/tokens/feed,
 * then scores each token via /v1/risk/:mint. Produces:
 *   - scripts/out/scan-results.json   (full raw data, all fields)
 *   - scripts/out/scan-summary.md     (post-ready tables: safe leaders, danger alerts)
 *
 * Usage:
 *   npx tsx scripts/scan-top-tokens.ts
 *   API_BASE=https://sentinel-api.apiworkersdev.workers.dev LIMIT=200 npx tsx scripts/scan-top-tokens.ts
 *
 * Strategic framing: this is NOT a Birdeye scanner. Source is the Bags leaderboard,
 * so the output is "risk layer on top of what Bags already shows the world".
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');

const API_BASE = process.env.API_BASE ?? 'https://sentinel-api.apiworkersdev.workers.dev';
const LIMIT = Number(process.env.LIMIT ?? 200);
const DELAY_MS = Number(process.env.DELAY_MS ?? 100);

type Tier = 'safe' | 'caution' | 'danger' | 'rug';

interface FeedItem {
  mint: string;
  symbol?: string;
  name?: string;
  lifetimeFees?: number;
  volume24h?: number;
  fdv?: number;
  priceChange24h?: number;
}

interface RiskScore {
  mint: string;
  score: number;
  tier: Tier;
  breakdown?: Record<string, number>;
  metadata?: {
    symbol?: string;
    name?: string;
    liquidity?: number;
    volume24h?: number;
    holders?: number;
  };
}

interface ScanRow {
  rank: number;
  mint: string;
  symbol: string;
  name: string;
  score: number;
  tier: Tier;
  lifetimeFees: number;
  volume24h: number;
  fdv: number;
  priceChange24h: number;
}

const TIER_ORDER: Record<Tier, number> = { safe: 0, caution: 1, danger: 2, rug: 3 };
const TIER_EMOJI: Record<Tier, string> = { safe: '🟢', caution: '🟡', danger: '🟠', rug: '🔴' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtUsd(n: number): string {
  if (!n || !isFinite(n)) return '-';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function fetchFeed(): Promise<FeedItem[]> {
  const body = await fetchJson<{ ok: boolean; data?: FeedItem[] }>(`${API_BASE}/v1/tokens/feed`);
  return body.data ?? [];
}

async function fetchRisk(mint: string): Promise<RiskScore | null> {
  try {
    const body = await fetchJson<{ ok: boolean; data?: RiskScore }>(`${API_BASE}/v1/risk/${mint}`);
    return body.data ?? null;
  } catch (err) {
    console.error(`  ! risk fetch failed for ${mint}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  console.log(`[scan] API_BASE=${API_BASE} LIMIT=${LIMIT}`);
  console.log(`[scan] Fetching Bags feed...`);
  const feed = await fetchFeed();
  console.log(`[scan] Feed returned ${feed.length} tokens`);

  const targets = feed.slice(0, LIMIT);
  const rows: ScanRow[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t.mint) continue;
    process.stdout.write(`[scan] ${i + 1}/${targets.length} ${t.symbol ?? t.mint.slice(0, 6)} ... `);
    const risk = await fetchRisk(t.mint);
    if (!risk) {
      console.log('skip');
      continue;
    }
    rows.push({
      rank: i + 1,
      mint: t.mint,
      symbol: t.symbol ?? risk.metadata?.symbol ?? '?',
      name: t.name ?? risk.metadata?.name ?? '',
      score: risk.score,
      tier: risk.tier,
      lifetimeFees: t.lifetimeFees ?? 0,
      volume24h: t.volume24h ?? risk.metadata?.volume24h ?? 0,
      fdv: t.fdv ?? 0,
      priceChange24h: t.priceChange24h ?? 0,
    });
    console.log(`${TIER_EMOJI[risk.tier]} ${risk.score}`);
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  // Sort: tier ASC (safe first), then lifetime fees DESC
  rows.sort((a, b) => {
    const t = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (t !== 0) return t;
    return b.lifetimeFees - a.lifetimeFees;
  });

  // Aggregates
  const byTier: Record<Tier, number> = { safe: 0, caution: 0, danger: 0, rug: 0 };
  for (const r of rows) byTier[r.tier]++;

  const scanned = rows.length;
  const pct = (n: number) => scanned ? `${((n / scanned) * 100).toFixed(1)}%` : '0%';

  // Top 10 "safe with fees" = buy-the-dip candidates
  const safeLeaders = rows.filter((r) => r.tier === 'safe').slice(0, 10);

  // Top 5 "danger but attracting money" = hooks for viral post
  const dangerHooks = rows
    .filter((r) => r.tier === 'danger' || r.tier === 'rug')
    .sort((a, b) => b.lifetimeFees - a.lifetimeFees)
    .slice(0, 5);

  // Write outputs
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, 'scan-results.json');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        apiBase: API_BASE,
        totalScanned: scanned,
        totalsByTier: byTier,
        rows,
      },
      null,
      2,
    ),
  );

  const md: string[] = [];
  md.push(`# Sentinel — Bags Leaderboard Risk Scan`);
  md.push('');
  md.push(`**Scanned**: ${scanned} tokens from Bags leaderboard`);
  md.push(`**Generated**: ${new Date().toISOString()}`);
  md.push('');
  md.push(`## Breakdown`);
  md.push('');
  md.push(`| Tier | Count | % |`);
  md.push(`|------|------:|--:|`);
  md.push(`| 🟢 Safe (70-100) | ${byTier.safe} | ${pct(byTier.safe)} |`);
  md.push(`| 🟡 Caution (40-69) | ${byTier.caution} | ${pct(byTier.caution)} |`);
  md.push(`| 🟠 Danger (10-39) | ${byTier.danger} | ${pct(byTier.danger)} |`);
  md.push(`| 🔴 Rug (0-9) | ${byTier.rug} | ${pct(byTier.rug)} |`);
  md.push('');

  md.push(`## 🟢 Top 10 Safe Leaders (high score + high fees)`);
  md.push('');
  md.push(`| # | Symbol | Score | Lifetime Fees | 24h Vol | 24h Δ |`);
  md.push(`|--:|--------|------:|--------------:|--------:|------:|`);
  safeLeaders.forEach((r, i) => {
    md.push(
      `| ${i + 1} | \`${r.symbol}\` | **${r.score}** | ${fmtUsd(r.lifetimeFees)} | ${fmtUsd(r.volume24h)} | ${r.priceChange24h.toFixed(1)}% |`,
    );
  });
  md.push('');

  md.push(`## 🚨 Danger Tokens Still Attracting Money`);
  md.push('');
  md.push(`| Symbol | Score | Tier | Lifetime Fees | 24h Vol |`);
  md.push(`|--------|------:|------|--------------:|--------:|`);
  dangerHooks.forEach((r) => {
    md.push(
      `| \`${r.symbol}\` | **${r.score}** | ${TIER_EMOJI[r.tier]} ${r.tier} | ${fmtUsd(r.lifetimeFees)} | ${fmtUsd(r.volume24h)} |`,
    );
  });
  md.push('');
  md.push(`---`);
  md.push(`Powered by [Sentinel](${API_BASE}) — risk scoring for Bags.fm`);
  md.push('');

  const mdPath = join(OUT_DIR, 'scan-summary.md');
  writeFileSync(mdPath, md.join('\n'));

  console.log('');
  console.log(`[scan] Done.`);
  console.log(`[scan]   ${scanned} scanned | safe=${byTier.safe} caution=${byTier.caution} danger=${byTier.danger} rug=${byTier.rug}`);
  console.log(`[scan]   → ${jsonPath}`);
  console.log(`[scan]   → ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
