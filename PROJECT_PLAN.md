# SENTINEL — Project Master Plan

> **"Don't trade blind."**
> AI risk intelligence + auto fee optimizer for Bags creators.

---

## 0. IDENTITY

| Field | Value |
|-------|-------|
| **Name** | Sentinel |
| **Ticker** | $SENT |
| **Mint** | `Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS` |
| **Tagline** | Don't trade blind. |
| **Track** | AI Agents |
| **Audience** | Creators first, traders second |
| **Hackathon** | The Bags Hackathon ($4M funding) |
| **Deadline** | 2 Iunie 2026 (~50 zile) |
| **Submission** | bags.fm/apply + DoraHacks BUIDL |

---

## 1. WHAT WE BUILD (2 Pillars only)

### Pillar 1 — Risk Scoring Engine (CORE)
AI-powered risk score 0-100 for any token on Bags.

| Component | Source | Status |
|-----------|--------|--------|
| RugCheck API integration (honeypot, LP lock, mint authority) | New | ✅ |
| Helius DAS (holder distribution, top holders %, creator wallet) | New | ✅ (needs API key) |
| Birdeye API (volume, FDV, liquidity depth, price history) | New | ✅ (needs API key) |
| Bags SDK state (lifetime fees, creator info, leaderboard rank) | New | ✅ (needs API key) |
| Scoring algorithm (weighted multi-signal → 0-100) | Port from apix402 | ✅ |
| Risk tier classification (Safe / Caution / Danger / Rug) | New | ✅ |
| KV cache (60s TTL per token) | Pattern from apix402 | ✅ |
| API endpoint: `GET /v1/risk/:mint` | New | ✅ |

### Pillar 2 — Auto Fee Optimizer
Agent that claims + compounds fees for creators automatically.

| Component | Source | Status |
|-----------|--------|--------|
| `sdk.fee.getAllClaimablePositions()` integration | Bags SDK | ✅ |
| `sdk.fee.getClaimTransactions()` integration | Bags SDK | ✅ |
| Fee dashboard (claimable amounts across all tokens) | New | ✅ |
| Auto-claim agent (periodic check + claim when profitable) | New | ⬜ |
| Compound mode (claimed fees → reinvest in best performer) | New | ⬜ |
| Partner config (`sdk.partner` + `sdk.config`) | Bags SDK | ⬜ |
| Transaction signing + claim execution (wallet adapter) | New | ✅ |
| API endpoint: `GET /v1/fees/:wallet` | New | ✅ |
| API endpoint: `POST /v1/fees/claim` | New | ✅ |
| Claim All button (batch claim) | New | ✅ |
| VersionedTransaction support | New | ✅ |

### Supporting Features (lightweight, not pillars)

| Feature | Priority | Status |
|---------|----------|--------|
| Discovery feed (new tokens, sorted by volume/risk) | HIGH | ✅ |
| Trending alerts (volume spikes, velocity) | MEDIUM | ⬜ |
| Telegram alerts (risk changes, fee claimable) | MEDIUM | ⬜ |
| MCP Server (Claude can query risk scores) | LOW | ⬜ |
| Claude Skill (NLP risk queries) | LOW | ⬜ |

---

## 2. WHAT WE DON'T BUILD (MVP cuts — validated by 4 AI consensus)

- ❌ Copy-trade (legal + technical risk, <$5K liquidity danger)
- ❌ Social trading complex (leaderboards, wallet tracking advanced)
- ❌ AI trading agent autonom (noise — every 3rd project says "AI trading")
- ❌ 4 pillars simultane (2 done 100% > 4 done 50%)
- ~~❌ Token launch before product is ready~~ → ✅ $SENT launched

---

## 3. TECH STACK

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend** | Cloudflare Workers + Hono | Already expert, free tier, global edge |
| **State** | Durable Objects | Live state, per-token tracking |
| **Cache** | KV | Risk score cache (60s TTL) |
| **Database** | D1 (SQLite) | Token history, fee logs, analytics |
| **Frontend** | React 18 + Vite + TailwindCSS | Fast, proven stack |
| **Blockchain** | @solana/web3.js + @bagsfm/bags-sdk v1.3.7 | Mandatory |
| **RPC** | Helius (free tier) | DAS API, webhooks, enhanced txs |
| **Risk Data** | RugCheck API + Birdeye API | Solana token analysis |
| **Signing** | Bags Agent Auth (wallet-signature → API key) | Native integration |
| **Alerts** | Telegram Bot API | Opt-in notifications |
| **Deploy** | Cloudflare Pages (dashboard) + Workers (API) | Single platform |

---

## 4. BAGS NATIVE INTEGRATION (cerință de bază, nu opțional)

### 4.1 App Store Presence
- [ ] Submit pe `bags.fm/apply` (App Icon, Name, Description, GitHub, Category: AI Agents)
- [ ] App vizibilă pe `bags.fm/apps` și `bags.fm/hackathon/apps`
- [ ] Status: Verified badge

### 4.2 Partner Config (fee-share integration)
- [ ] `sdk.config` — create fee-share config pentru Sentinel
- [ ] `sdk.partner` — register as partner (Sentinel primește % din fees)
- [ ] Creatorii alocă un % din royalty-ul lor (1% per trade) către Sentinel
- [ ] Sentinel claim-ează partner fees + execută logica (compound/redistribute)

### 4.3 Token ($SENT)
- [x] Launch pe Bags — mint: `Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS`
- [ ] Fee share config: 50% creator (noi), 30% holders, 20% dev fund
- [ ] Token utility: gate premium features (auto-compound, priority alerts)

### 4.4 SDK Integration Depth
- [ ] `sdk.state` — token creators, lifetime fees, leaderboards
- [ ] `sdk.trade` — swap quotes (for compound reinvest)
- [ ] `sdk.fee` — claimable positions, claim transactions
- [ ] `sdk.config` — fee-share configurations
- [ ] `sdk.partner` — partner fee claiming
- [ ] `sdk.solana` — Jito bundles for fast execution

---

## 5. DATA PIPELINE

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  RugCheck   │───▶│              │    │   KV Cache  │
│  (honeypot, │    │   Sentinel   │───▶│  (60s TTL)  │
│   LP, mint) │    │   Risk       │    └─────────────┘
└─────────────┘    │   Engine     │           │
                   │              │           ▼
┌─────────────┐    │  (CF Worker) │    ┌─────────────┐
│   Helius    │───▶│              │───▶│  D1 SQLite  │
│  (holders,  │    │              │    │  (history)  │
│   DAS, txs) │    └──────┬───────┘    └─────────────┘
└─────────────┘           │
                          ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Birdeye    │───▶│   Scoring    │───▶│  Dashboard  │
│  (volume,   │    │  Algorithm   │    │  (React)    │
│   FDV, liq) │    └──────────────┘    └─────────────┘
└─────────────┘
                   ┌──────────────┐
┌─────────────┐    │   Fee        │    ┌─────────────┐
│  Bags SDK   │───▶│   Optimizer  │───▶│  Telegram   │
│  (fees,     │    │   Agent      │    │  Alerts     │
│   state)    │    └──────────────┘    └─────────────┘
└─────────────┘
```

---

## 6. CALENDAR (50 zile: 13 Apr — 2 Jun 2026)

### W1: Apr 13-20 — FOUNDATION + BAGS NATIVE
- [x] Repo setup (monorepo: `worker/`, `dashboard/`, `shared/`)
- [x] `npm init`, TypeScript strict, Hono, wrangler.toml
- [x] Install + test `@bagsfm/bags-sdk` v1.3.7
- [x] Bags API key de la dev.bags.fm
- [x] Helius free tier RPC + API key
- [ ] **Submit pe bags.fm/apply** (AI Agents, "no coin yet")
- [ ] Partner config exploratory (`sdk.partner`, `sdk.config`)
- [x] Basic token feed endpoint (list recent launches via Bags API)
- [x] RugCheck API: first call, understand response schema
- [x] Birdeye API: first call, get token data
- [x] **Deliverable**: API live pe CF Workers, risk scoring funcțional

### W2: Apr 21-27 — RISK ENGINE (core algorithm)
- [x] RugCheck integration complet (honeypot, LP lock, mint authority, freeze)
- [ ] Helius DAS integration (holder count, top 10 holders %, creator wallet)
- [ ] Birdeye integration (24h volume, FDV, liquidity depth, price change)
- [ ] Bags SDK state (lifetime fees, creator info)
- [x] Scoring algorithm v1 (weighted signals → 0-100)
- [x] Risk tiers: Safe (70-100), Caution (40-69), Danger (10-39), Rug (0-9)
- [x] KV cache layer (60s TTL)
- [x] `GET /v1/risk/:mint` endpoint live
- [ ] Unit tests for scoring edge cases
- [ ] **Deliverable**: Risk score API funcțional, cache, tested

### W3: Apr 28 — May 4 — DASHBOARD + DISCOVERY
- [x] React project setup (Vite + Tailwind + React 18)
- [x] Discovery feed page (token list, sorted by volume/risk/new)
- [x] Token detail page (risk score gauge, breakdown per factor)
- [x] Search bar (by token name, mint address)
- [ ] Filter/sort (risk level, volume, age)
- [x] Responsive design (mobile-first — Bags users are mobile)
- [x] Deploy dashboard pe Cloudflare Pages
- [x] **Deliverable**: Dashboard live cu discovery + risk scores

### W4: May 5-11 — FEE OPTIMIZER (pillar 2)
- [x] `sdk.fee.getAllClaimablePositions()` — list all claimable for a wallet
- [x] `sdk.fee.getClaimTransactions()` — build claim txs
- [x] Fee dashboard page (total claimable, per-token breakdown)
- [x] Claim button (one-click claim all)
- [ ] Auto-claim agent logic (periodic check, threshold-based)
- [ ] Compound mode v1 (claim → reinvest via `sdk.trade`)
- [ ] Partner config: Sentinel as fee-share recipient
- [x] Transaction signing flow (wallet adapter: Phantom + Solflare)
- [x] **Deliverable**: Fee optimizer funcțional end-to-end

### W5: May 12-18 — ALERTS + POLISH
- [ ] Telegram bot setup (@SentinelBagsBot)
- [ ] Alert: risk score change (token drops from Safe to Danger)
- [ ] Alert: new fees claimable above threshold
- [ ] Alert: trending token (volume spike >5x in 1h)
- [ ] Dashboard polish (animations, loading states, error handling)
- [ ] Dark mode (navy/black + cyan/blue electric — per R4 recommendation)
- [ ] Landing page (hero, features, CTA)
- [ ] **Deliverable**: Alerts funcționale, dashboard polished

### W6: May 19-25 — TOKEN LAUNCH + INTEGRATIONS
- [x] $SENT token launch pe Bags — `Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS`
- [ ] Fee share config: 50% creator, 30% holders, 20% dev
- [ ] Token-gated premium features (auto-compound, priority alerts)
- [ ] MCP Server (optional — risk score query tool for Claude)
- [ ] Claude Skill (optional — "How risky is $TOKEN?")
- [ ] Update bags.fm/apply cu contract address
- [ ] **Deliverable**: $SENT live pe Bags, premium features gated

### W7: May 26 — Jun 1 — DEMO + COMMUNITY + SUBMIT
- [ ] Demo video 3-5 min (screen recording + voiceover)
- [ ] Killer 30-sec clip (rug detected → alert → "saved $X")
- [ ] GitHub repo cleanup (README, LICENSE, screenshots)
- [ ] X (Twitter) account (@SentinelBags) + daily posts
- [ ] Discord server (or Telegram group)
- [ ] Creator outreach (DM 50+ Bags creators: "free risk score for your token")
- [ ] DoraHacks BUIDL submission
- [ ] bags.fm/apply final update
- [ ] **Deliverable**: Everything submitted, vote campaign active

---

## 7. DEMO STRATEGY (30-sec killer clip)

**The money shot:**
1. Open Sentinel dashboard → trending token with 🔴 DANGER score
2. Click → breakdown: "Mint authority not revoked, top holder 45%, LP unlocked"
3. Cut to: 2 hours later → token rugs, -95%
4. Text overlay: **"Sentinel flagged it. Did you listen?"**
5. Tagline: **"Don't trade blind."**

**Full demo (3-5 min):**
1. Discovery feed — browse trending Bags tokens
2. Risk score deep-dive — pick a token, show all signals
3. Fee optimizer — connect wallet, see unclaimed fees, one-click claim
4. Auto-compound — fees reinvested automatically
5. Telegram alert — live notification of risk change
6. Token $SENT — premium unlock flow

---

## 8. VOTE STRATEGY (target: 700+ voturi)

| Channel | Target | Method |
|---------|--------|--------|
| $SENT holders | 100-200 | Token launch → natural vote incentive |
| Creator outreach | 50-100 | DM 100+ creators offering free analytics |
| X (Twitter) | 100-200 | Daily alpha posts, risk scores, trending |
| Discord/Telegram | 50-100 | Community, beta access |
| Demo video viral | 100-200 | 30-sec clip → X + reddit + YouTube Shorts |
| Cross-promotion | 50+ | Partner with other hackathon projects |

---

## 9. COMPETITIVE ANALYSIS (updated Apr 13)

| # | Project | Votes | Track | Our advantage |
|---|---------|-------|-------|---------------|
| 1 | Orbis API | 1,250 | Other | API marketplace, no risk scoring |
| 2 | Abraxas | 1,231 | AI Agents | RWA focus, not creator tokens |
| 3 | OnChainClaw | 1,095 | AI Agents | Social feed for agents, no risk intel |
| 4 | quAId | 1,011 | AI Agents | Sports prediction, not crypto risk |
| 5 | Clipur.com | 815 | Social Finance | Clipping campaigns, different vertical |
| 6 | OCCUPY | 759 | DeFi | Meme token, not a tool |
| 7 | JackBuilds | 694 | AI Agents | Generic AI tools, not Bags-native deep |
| 8 | Cluck Norris | 673 | Other | Education app, not intelligence |
| 9 | Trenchy.fun | 672 | Social Finance | Closest competitor — but no risk engine |

**Key insight**: Nobody in top 9 does real-time risk scoring + fee optimization. We fill a gap.

---

## 10. RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| RugCheck API rate limit or downtime | Risk scores unavailable | Fallback to Helius+Birdeye only (degraded score) |
| Bags SDK breaking change | Integration breaks | Pin SDK version, test on update |
| Helius free tier limit (50K credits/month) | Data pipeline blocked | Cache aggressively, batch requests |
| Low vote count | Miss top 100 | Start community building W5, not W7 |
| Scope creep | Unfinished pillars | 2 pillars ONLY. If tempted, re-read this plan. |
| Token $SENT dumps | Bad optics | Launch late (W6), utility-first, no hype pre-product |
| Partner config rejected by Bags | Can't be native app | Apply early W1, have fallback as external tool |

---

## 11. ACCOUNTS & KEYS NEEDED

- [ ] Bags API key — dev.bags.fm
- [ ] Helius API key — helius.dev (free tier)
- [ ] Birdeye API key — birdeye.so (free tier)
- [ ] RugCheck API — rugcheck.xyz (check if key needed)
- [ ] Cloudflare account (existing)
- [ ] Telegram Bot — @BotFather → @SentinelBagsBot
- [ ] X account — @SentinelBags (or similar available handle)
- [ ] Solana wallet (new, dedicated for Sentinel)
- [ ] GitHub repo — github.com/loquit-doru/sentinel (or similar)
- [ ] DoraHacks account (for BUIDL submission)

---

## 12. REPO STRUCTURE

```
sentinel/
├── PROJECT_PLAN.md          ← this file (master checklist)
├── CHANGELOG.md
├── README.md
├── package.json             ← npm workspaces root
├── tsconfig.base.json
├── worker/                  ← Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts         ← Hono app, routes
│   │   ├── risk/
│   │   │   ├── engine.ts    ← scoring algorithm
│   │   │   ├── rugcheck.ts  ← RugCheck API client
│   │   │   ├── helius.ts    ← Helius DAS client
│   │   │   ├── birdeye.ts   ← Birdeye API client
│   │   │   └── types.ts     ← RiskScore, RiskTier, etc.
│   │   ├── fees/
│   │   │   ├── optimizer.ts ← fee claim + compound logic
│   │   │   └── partner.ts   ← Bags partner config
│   │   ├── bags/
│   │   │   ├── sdk.ts       ← Bags SDK wrapper
│   │   │   └── feed.ts      ← token feed from Bags
│   │   └── alerts/
│   │       └── telegram.ts  ← Telegram bot notifications
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── dashboard/               ← React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Discovery.tsx
│   │   │   ├── TokenDetail.tsx
│   │   │   ├── FeeOptimizer.tsx
│   │   │   └── Landing.tsx
│   │   ├── components/
│   │   │   ├── RiskGauge.tsx
│   │   │   ├── TokenCard.tsx
│   │   │   ├── FeeTable.tsx
│   │   │   └── Header.tsx
│   │   └── lib/
│   │       ├── api.ts       ← fetch from worker API
│   │       └── bags.ts      ← Bags SDK client-side
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── shared/                  ← shared types/utils
    ├── types.ts
    └── constants.ts
```

---

## 13. SUCCESS CRITERIA

La final, Sentinel trebuie să poată:

1. **Risk Score**: Dai un mint address → primești scor 0-100 + breakdown în <2 sec
2. **Discovery**: Deschizi dashboard → vezi ultimele 50 tokens sortate by risk/volume
3. **Fee Optimizer**: Conectezi wallet → vezi fees claimable → one-click claim
4. **Auto-compound**: Toggle ON → fees claimed automat + reinvestite
5. **Alerts**: Primești Telegram: "⚠️ $TOKEN dropped from Safe to Danger"
6. **App Store**: Sentinel apare pe bags.fm/apps cu Verified badge
7. **Token**: $SENT live pe Bags, premium features gated
8. **Demo**: Video 3-5 min + clip 30 sec care face oamenii să dea vote

---

*Last updated: 13 April 2026*
*Total checkboxes: 87*
