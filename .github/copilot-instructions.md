# Copilot Instructions (Sentinel)

## Communication
- Discuss in Romanian.
- Keep code, identifiers, and user-facing strings in English.

## Big Picture
- **Project**: Sentinel ($SENT) — AI risk intelligence + wallet portfolio scanner for Bags traders & creators.
- **Hackathon**: The Bags Hackathon ($4M funding), deadline 2 June 2026, track: AI Agents.
- **Stack**: TypeScript, Cloudflare Workers (Hono), React 18 + Vite + Tailwind, Bags SDK, Solana.
- **Architecture**: Monorepo with `worker/`, `dashboard/`, `shared/` packages.

| Package | Purpose |
|---------|---------|
| `worker/` | Cloudflare Worker API (risk scoring, wallet x-ray, token feed) |
| `dashboard/` | React frontend (discovery, risk detail, wallet x-ray) |
| `shared/` | Shared types + constants |

## Core Pillars (only 2 — don't add more)
1. **Risk Scoring Engine** — RugCheck + Helius DAS + Birdeye → score 0-100 per token
2. **Wallet X-Ray** — Paste wallet → scan all holdings → portfolio health score + flagged tokens

## Implementation Guidelines
- Follow existing code patterns per package.
- Use TypeScript strict mode.
- Risk scoring weights live in `shared/constants.ts` — don't hardcode.
- Types live in `shared/types.ts`.
- Run `npm --workspaces run check` before committing.
- Risk score tiers: Safe (70-100), Caution (40-69), Danger (10-39), Rug (0-9).

## Key External APIs
- **Bags SDK**: `@bagsfm/bags-sdk` — state, fee, trade, config, partner
- **RugCheck**: `https://api.rugcheck.xyz/v1` — honeypot, LP lock, mint authority
- **Helius**: DAS API + RPC — holder distribution, enhanced transactions
- **Birdeye**: `https://public-api.birdeye.so` — volume, FDV, liquidity

## Bags Integration (mandatory)
- App Store: submitted via bags.fm/apply
- Partner config: sdk.partner + sdk.config (Sentinel receives fee %)
- Token $SENT: launched on Bags at the end, not before product

## What NOT to build
- Copy-trade (legal + technical risk)
- Social trading complex
- AI trading agent autonom
- 4 pillars simultane

## Dev Workflows
- Install: `npm install`
- Worker dev: `npm run dev:worker`
- Dashboard dev: `npm run dev:dashboard`
- Typecheck all: `npm --workspaces run check`
- Deploy worker: `npm run deploy:worker`
- Deploy dashboard: `npm run deploy:dashboard`

## CHANGELOG
After any code change, add an entry to `CHANGELOG.md` in project root.
