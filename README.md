# Sentinel ⬡

> **Don't trade blind.**

AI risk intelligence + wallet portfolio scanner for [Bags](https://bags.fm) traders & creators. Built for the [Bags Hackathon](https://bags.fm/hackathon) ($4M funding) — Track: **AI Agents**.

**$SENT**: [`Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS`](https://bags.fm/token/Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS) — launched on Bags

[![Live Dashboard](https://img.shields.io/badge/Dashboard-Live-06b6d4?style=flat-square)](https://sentinel-dashboard-3uy.pages.dev)
[![API](https://img.shields.io/badge/API-Live-22c55e?style=flat-square)](https://sentinel-api.apiworkersdev.workers.dev/health)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square)](https://typescriptlang.org)

---

## What it does

### Pillar 1 — Risk Scoring Engine (core)
Real-time risk score **0-100** for any token on Bags. Combines 8 weighted signals from 4 data sources into a single actionable score with tier classification.

| Factor | Weight | Source |
|--------|--------|--------|
| Honeypot risks | 20% | RugCheck |
| LP Locked | 15% | RugCheck |
| Mint Authority | 15% | RugCheck |
| Freeze Authority | 10% | RugCheck |
| Top Holder % | 15% | Helius DAS |
| Liquidity Depth | 10% | Birdeye |
| Volume Health | 10% | Birdeye |
| Creator Reputation | 5% | Bags SDK |

**Tiers**: 🟢 Safe (70-100) · 🟡 Caution (40-69) · 🔴 Danger (10-39) · ⛔ Rug (0-9)

### Pillar 2 — Wallet X-Ray
Paste any Solana wallet → instant risk scan of ALL token holdings. Portfolio health score + flagged tokens.

- Scans all SPL token holdings via Helius RPC
- Batch risk scoring (up to 20 tokens concurrently)
- **Portfolio Health** score (0-100, weighted average)
- Flagged tokens (score < 40) highlighted in red
- Click any token → full risk breakdown

---

## Live URLs

| Service | URL |
|---------|-----|
| Dashboard | [sentinel-dashboard-3uy.pages.dev](https://sentinel-dashboard-3uy.pages.dev) |
| API | [sentinel-api.apiworkersdev.workers.dev](https://sentinel-api.apiworkersdev.workers.dev/health) |

---

## Architecture

```
sentinel/
├── worker/      → Cloudflare Workers + Hono (API backend)
├── dashboard/   → React 18 + Vite + TailwindCSS
├── mcp-server/  → MCP Server for Claude Skills
└── shared/      → TypeScript types + constants
```

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Service status |
| GET | `/stats` | API usage analytics |
| GET | `/v1/risk/:mint` | Risk score (0-100) for any token |
| GET | `/v1/tokens/feed` | Top tokens by lifetime fees |
| GET | `/v1/portfolio/:wallet` | Wallet X-Ray (all holdings + risk) |

### Stack

- **Backend**: Cloudflare Workers + Hono
- **Frontend**: React 18 + Vite + TailwindCSS
- **Blockchain**: @solana/web3.js + @bagsfm/bags-sdk
- **Risk Data**: RugCheck API + Birdeye API + Helius DAS
- **Cache**: Cloudflare KV (60s risk, 30s feed/fees)
- **Analytics**: Plausible + internal KV tracking

---

## Claude Skills (MCP Server)

Sentinel exposes its risk intelligence as Claude tools via the [Model Context Protocol](https://modelcontextprotocol.io).

### Available Tools

| Tool | Description |
|------|-------------|
| `get_risk_score` | Risk score (0-100) for any Solana token |
| `get_trending_tokens` | Top tokens by lifetime fees on Bags |
| `get_claimable_fees` | Unclaimed fees for a wallet |
| `compare_tokens` | Side-by-side risk comparison (2-5 tokens) |

### Setup in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sentinel": {
      "command": "node",
      "args": ["C:/Users/YOU/sentinel/mcp-server/dist/index.js"]
    }
  }
}
```

Then ask Claude: *"How risky is token DezXAZ...B263?"* or *"Show me trending tokens on Bags"*

---

## Bags Integration

- **Bags API**: Token feed (lifetime fees, creators), claimable positions
- **Bags SDK**: Partner registration, fee-share config
- **Risk Scoring**: RugCheck + Birdeye + Helius → 8 weighted signals → score 0-100
- **Wallet X-Ray**: Helius RPC → all holdings → batch risk scoring → portfolio health

---

## Getting Started

```bash
# Install
npm install

# Development
npm run dev:worker       # API on :8787
npm run dev:dashboard    # Dashboard on :5173

# Typecheck all packages
npm --workspaces run check

# Deploy
npm run deploy:worker
npm run deploy:dashboard

# Tests
npm --workspace worker run test   # 17 tests
```

### Environment Variables

Create `worker/.dev.vars` for local development:

```
BAGS_API_KEY=your_bags_api_key
HELIUS_API_KEY=your_helius_api_key
BIRDEYE_API_KEY=your_birdeye_api_key
```

Get API keys from:
- [Bags Developer Dashboard](https://dev.bags.fm)
- [Helius](https://helius.dev)
- [Birdeye](https://birdeye.so)

---

## Track

**AI Agents** — [The Bags Hackathon](https://bags.fm/hackathon) ($4M funding)

## License

MIT
