# CHANGELOG

## 2026-04-13
### Dashboard — Discovery + Risk Detail
**Fișier(e)**: `dashboard/src/App.tsx`, `dashboard/src/api.ts`, `dashboard/src/pages/FeedPage.tsx`, `dashboard/src/pages/RiskDetailPage.tsx`, `dashboard/src/components/RiskDisplay.tsx`, `dashboard/src/components/SearchBar.tsx`
**Motiv**: W3 deliverable — dashboard cu discovery feed + risk score visualization
**Adăugat**:
- Discovery feed page (token list by lifetime fees, volume, FDV, 24h change, risk badge)
- Token risk detail page (score gauge SVG, tier badge, breakdown bars per factor)
- Search bar (paste mint address → scan)
- Skeleton loading states, empty state, error handling
- API client (`api.ts`) for `/v1/risk/:mint` and `/v1/tokens/feed`
- Responsive layout (mobile-first)

### Unit Tests (17 passing)
**Fișier(e)**: `worker/tests/risk-analyzers.test.ts`, `worker/package.json`
**Motiv**: Coverage for scoring edge cases (W2 checklist)
**Adăugat**:
- 10 tests for `analyzeRugCheck` (mint authority, freeze, LP lock, honeypot dangers, top holder, rug flag)
- 4 tests for `analyzeBirdeye` (liquidity normalization, volume health, null fallbacks)
- 3 tests for `analyzeHeliusHolders` (empty, distributed, whale-heavy)
- vitest added as dev dependency, `npm --workspace worker run test`

### Risk Scoring Engine — Live
**Fișier(e)**: `worker/src/risk/engine.ts`, `worker/src/risk/rugcheck.ts`, `worker/src/risk/birdeye.ts`, `worker/src/risk/helius.ts`, `worker/src/risk/types.ts`, `worker/src/index.ts`
**Motiv**: Pillar 1 (Risk Scoring) — core feature needed for hackathon MVP
**Adăugat**:
- `GET /v1/risk/:mint` live — fetches RugCheck + Birdeye + Helius in parallel, computes weighted score 0-100
- Weighted scoring engine with 8 factors (honeypot, lpLocked, mintAuthority, freezeAuthority, topHolderPct, liquidityDepth, volumeHealth, creatorReputation)
- Graceful degradation — works with RugCheck only (public API, no key), enriched by Birdeye/Helius when keys provided
- Address validation (base58, 32-44 chars), rugged flag override (instant score=0)
- Fixed RugCheck types to match actual API: mintAuthority/freezeAuthority at top level, lpLockedPct under markets[].lp
- Tested with BONK token: score=72, tier=safe ✅

### Token Feed + KV Cache
**Fișier(e)**: `worker/src/feed/bags.ts`, `worker/src/index.ts`, `worker/wrangler.toml`
**Motiv**: Discovery feed (W1 deliverable) + performance via caching
**Adăugat**:
- `GET /v1/tokens/feed` — top Bags tokens by lifetime fees via Bags public API
- KV cache layer: risk scores 60s TTL, token feed 30s TTL, `x-cache` header (HIT/MISS)
- `SENTINEL_KV` KV namespace binding in wrangler.toml
- Bags API requires `x-api-key` — feed returns `[]` until key configured

### Project Init
**Files**: all
**Added**: Monorepo setup — worker (Hono), dashboard (React+Vite+Tailwind), shared (types+constants). Stub endpoints for /v1/risk/:mint, /v1/fees/:wallet, /v1/tokens/feed. PROJECT_PLAN.md with 87 checkboxes.
