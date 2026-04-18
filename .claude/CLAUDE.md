# Claude Configuration for sentinel

## Project Overview
Sentinel is a Bags.fm risk intelligence tool — real-time token risk scoring + auto fee optimizer for Solana token creators.

**Hackathon**: Bags Hackathon ($4M) · Track: AI Agents · Deadline: June 2, 2026
**$SENT**: `Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS`

## Available Commands
- **/retrospective** - Analyze conversation, extract learnings, update skills

## Vault Sync
After significant changes (new API endpoints, risk engine changes, new dashboard pages, external API integrations), update:
- **Snapshot**: `C:\Users\quit\Desktop\dev-vault\projects\sentinel.md` — Change Log + Known Issues + Progress section
- **Wiki** (`C:\Users\quit\Desktop\dev-vault\wiki\sentinel\`):
  - API/module changes → `architecture.md`
  - Risk scoring changes → `risk-engine.md`

## Project Conventions
- TypeScript monorepo (npm workspaces): `worker/`, `dashboard/`, `shared/`
- Run `npm run check` before commits
- Deploy dashboard with `--branch production` flag (required!)
- KV analytics disabled by default in prod (`ENABLE_KV_ANALYTICS=1` to enable)

## Key Files
- `worker/src/index.ts` - API routes
- `worker/src/risk/engine.ts` - Risk scoring (8 factors)
- `shared/types.ts` - Shared types
- `shared/constants.ts` - Risk weights, SENT_MINT, tier thresholds
- `worker/wrangler.toml` - CF Worker config
