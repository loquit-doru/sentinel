# Sentinel ⬡

> **Don't trade blind.**

AI risk intelligence + auto fee optimizer for [Bags](https://bags.fm) creators. Built for the [Bags Hackathon](https://bags.fm/hackathon) ($4M funding) — Track: **AI Agents**.

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

### Pillar 2 — Auto Fee Optimizer
Discovers unclaimed creator fees across all tokens, builds claim transactions, and supports batch claiming with a single click.

- Wallet connect (Phantom / Solflare)
- Per-position and "Claim All" batch claiming
- VersionedTransaction support
- Transaction signatures with Solscan links

### Token Launch Wizard
3-step guided flow to launch a new token on Bags with custom fee-share configuration:
1. **Token Details** — name, symbol, description, image, socials
2. **Fee Distribution** — allocate bps across wallets (presets included)
3. **Review & Launch** — sign and deploy on-chain

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
└── shared/      → TypeScript types + constants
```

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Service status |
| GET | `/stats` | API usage analytics |
| GET | `/v1/risk/:mint` | Risk score (0-100) for any token |
| GET | `/v1/tokens/feed` | Top tokens by lifetime fees |
| GET | `/v1/fees/:wallet` | Claimable fee positions |
| POST | `/v1/fees/claim` | Build claim transactions |
| POST | `/v1/token/create` | Create token metadata |
| POST | `/v1/token/fee-config` | Create fee-share config |
| POST | `/v1/token/launch` | Build launch transaction |

### Stack

- **Backend**: Cloudflare Workers + Hono
- **Frontend**: React 18 + Vite + TailwindCSS
- **Blockchain**: @solana/web3.js + @bagsfm/bags-sdk
- **Risk Data**: RugCheck API + Birdeye API + Helius DAS
- **Cache**: Cloudflare KV (60s risk, 30s feed/fees)
- **Analytics**: Plausible + internal KV tracking

---

## Bags Integration

- **Bags API**: Token feed (lifetime fees, creators), claimable positions, claim transactions
- **Bags SDK**: Token launch, fee-share config, partner registration
- **Fee Sharing**: Full claim + compound flow with wallet signing
- **Token Launch**: Create + configure + deploy tokens on Bags

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
