# Sentinel ⬡

> **Don't trade blind.**

AI risk intelligence + auto fee optimizer for [Bags](https://bags.fm) creators.

## What it does

**Pillar 1 — Risk Scoring Engine**
Real-time risk score (0-100) for any token on Bags. Combines RugCheck (honeypot, LP lock, mint authority), Helius (holder distribution), and Birdeye (volume, liquidity) into a single actionable score.

**Pillar 2 — Auto Fee Optimizer**
Automatically discovers unclaimed creator fees across all tokens, claims them when profitable, and optionally compounds earnings into best-performing assets.

## Stack

- **Backend**: Cloudflare Workers + Hono
- **Frontend**: React 18 + Vite + TailwindCSS
- **Blockchain**: @solana/web3.js + @bagsfm/bags-sdk
- **Data**: RugCheck API + Helius DAS + Birdeye API

## Setup

```bash
npm install
npm run dev:worker     # API on :8787
npm run dev:dashboard  # Dashboard on :5173
```

## Track

AI Agents — [The Bags Hackathon](https://dorahacks.io/hackathon/the-bags-hackathon)

## License

MIT
