# Feature Discovery Prompt — Sentinel ($SENT)

Use this prompt with any AI (ChatGPT, Gemini, Claude, etc.) to brainstorm new features.

---

## PROMPT START — Copy everything below this line

---

You are a hackathon strategy consultant. I need you to identify high-impact features I should add to my project to maximize my chances of winning. Be creative, specific, and prioritize features by effort-to-impact ratio.

## THE HACKATHON

**Name**: The Bags Hackathon
**Prize pool**: $1,000,000 USD (top 100 projects get $10K–$100K each)
**Deadline**: June 2, 2026 (47 days from now)
**Platform**: DoraHacks
**Ecosystem**: Solana
**Submitted projects so far**: ~15 (226 hackers registered)

### Submission Requirements
- Must be launched on Bags (bags.fm)
- Must have a token linked to the project
- GitHub repo required (public or with judge access)
- Demo video required (3–5 minutes)
- X/Twitter handle required

### Judging Criteria (implicit from rules)
- Meaningful integration with Bags platform (API, SDK, token launching, trading, or creator tools) ranks higher
- Projects that "ship and get traction" will be rewarded
- New work or significant new features (pre-existing projects allowed if substantial new functionality added)

### 9 Tracks Available
1. **Bags API** — Tools, dashboards, bots, integrations powered by Bags REST API and TypeScript SDK
2. **Fee Sharing** — Novel ways to leverage, distribute, or visualize the 1% creator fee on every trade
3. **AI Agents** — Autonomous agents that trade, analyze markets, or manage token communities on Solana
4. **Claude Skills** — Claude skills for research, trading insights, portfolio management, or creator workflows
5. **DeFi** — Liquidity strategies, lending protocols, yield products on Solana
6. **Payments** — Real-world and P2P payment flows using creator tokens on Solana
7. **Privacy** — Privacy-preserving tools for trading, holding, or transacting with tokens
8. **Social Finance** — Social experiences around token ownership: leaderboards, group portfolios, community-driven investing
9. **Other** — Projects that break the mold and push creator finance forward in ways nobody has thought of yet

### What Bags Is
Bags is a creator funding platform on Solana. Creators launch tokens, build communities, earn royalties. Key mechanic: **1% fee on every trade** — split between creator and fee-share partners. The platform has a REST API and TypeScript SDK (`@bagsfm/bags-sdk`).

---

## MY PROJECT — SENTINEL ($SENT)

**Track**: AI Agents
**Tagline**: AI risk intelligence + wallet portfolio scanner for Bags traders & creators
**Token**: $SENT (already launched on Bags, mint `Az1LWLGFs63XscCQGeZyn5qVV31SRKtYn53hMB6bBAGS`)
**Stack**: TypeScript, Cloudflare Workers (Hono), React 18 + Vite + Tailwind, Solana
**Monorepo**: `worker/` (API), `dashboard/` (React frontend), `shared/` (types), `mcp-server/` (23 tools)

### Core Pillars (already built and deployed)

**Pillar 1: Risk Scoring Engine**
- 8-signal weighted score 0–100 per token
- Signals: honeypot risks (20%), LP locked (15%), mint authority (15%), freeze authority (10%), top holder concentration (15%), liquidity depth (10%), volume health (10%), creator reputation (5%)
- Data sources: RugCheck API, Helius DAS/RPC, Birdeye, Bags API
- Tiers: Safe (70–100), Caution (40–69), Danger (10–39), Rug (0–9)
- Instant override: if RugCheck flags `ruggedFlag` → score=0, tier=rug
- KV cache: 60s TTL per token

**Pillar 2: Wallet X-Ray**
- Paste any Solana wallet → batch scan all SPL holdings (up to 20 concurrent)
- Portfolio Health score (weighted average of all holdings)
- Flagged tokens highlighted (score < 40)
- Auto-fills from connected wallet (Phantom/Solflare)

### All Features Already Implemented (10 modules)

1. **Risk Scoring Engine** — 8 signals, 4 data sources, cached in KV
2. **Wallet X-Ray** — batch scan + portfolio health score
3. **Auto Fee Optimizer** — smart fee claim analysis, urgency scoring, claim bundles with TTL
4. **BagsSwarm Intelligence** — 5 AI agents (Fee Scanner, Risk Sentinel, Auto Claimer, Launch Advisor, Trade Signal) powered by Claude API → consensus vote (proceed/hold/reject/split) with confidence score
5. **Campaign OS** — fee routing policies with 4 presets (growth, community reward, treasury, balanced)
6. **Creator Escrow** — milestone-based payments between parties
7. **Proof Dashboard** — 14 pages: Landing, Discovery Feed, Risk Detail, Wallet X-Ray, Fees, Smart Trade, Alert Feed, Creator Profile, Claims, Bags Native, Swarm, Monitor, Firewall, Token Launch
8. **Bags Partner Integration** — partner registration, BPS config, claim stats via Bags SDK
9. **$SENT Token Gating** — 3 tiers (Free/Holder/Whale) checked via Helius RPC
10. **Alert System** — cron every 15min → LP drain detection → Telegram alerts, per-wallet monitoring with auto-connect

### API Endpoints (40+ routes, all live)
- `GET /v1/risk/:mint` — risk score for any token
- `GET /v1/tokens/feed` — top tokens by lifetime fees
- `GET /v1/portfolio/:wallet` — Wallet X-Ray
- `GET /v1/creator/:wallet` — creator reputation profile
- `GET /v1/badge/:mint` — embeddable SVG risk badge
- `GET /v1/fees/:wallet` — claimable fee positions
- `GET /v1/fees/:wallet/smart` — risk-aware fee urgency
- `POST /v1/fees/claim` — build claim txs
- `GET /v1/trade/quote` — swap quote + risk score
- `POST /v1/trade/swap` — build swap tx
- `POST /v1/token/create` — create token metadata
- `POST /v1/token/launch` — create launch tx
- `POST /v1/swarm/:wallet` — run 5-agent AI analysis
- `POST /v1/monitor/register` — register wallet + Telegram
- `POST /v1/alerts/scan` — on-demand scan
- `GET /v1/gate/:wallet` — check $SENT token gate tier
- `GET /v1/partner/:wallet` — partner config + BPS
- `GET /v1/app/info` — app store metadata

### MCP Server (23 tools via stdio)
Tools for: risk scoring, trending tokens, fee analysis, token comparison, wallet x-ray, creator profile, swarm operations, campaign management, escrow, partner config, token gate checks.

### External APIs Used
| API | Purpose |
|-----|---------|
| RugCheck | Honeypot, LP lock, mint/freeze authority, rug detection |
| Helius | DAS API (holders), token accounts, RPC, $SENT gate |
| Birdeye | Volume, FDV, liquidity depth |
| Bags SDK | Token feed, fees, partner, config, trade, launch |
| Anthropic Claude | Swarm intelligence (5-agent consensus) |
| Telegram Bot API | Alerts, monitoring notifications |

### What's NOT Yet Built
- Claude Skill (the hackathon has a dedicated track for this)
- Historical portfolio tracking over time
- Social sharing of wallet scan results
- Trending alerts (volume spike detection)
- D1 SQLite for persistent analytics
- Community presence (X account, Discord/Telegram group)
- Demo video

---

## COMPETITION — Current Submissions (15 projects)

| # | Name | Track | What it does |
|---|------|-------|--------------|
| 1 | SwarmFi | DeFi | 128+ AI agents for oracles, prediction markets, auto-rebalancing vaults. Fee split: 50% Bags, 30% treasury. |
| 2 | Bags Campaign Launcher | Bags API | Helps creators turn ideas into live onchain campaigns with simple launch flow. |
| 3 | Trenchy.fun | Bags API | All-in-one platform combining multiple DeFi tools under one roof. |
| 4 | BagsBrain | Bags API | "Operating System" for token creators on Bags. |
| 5 | The Bags – AI Token Launchpad | Bags API | AI-powered token creation, wallet connection, portfolio tracking. |
| 6 | Aura – Confidential Creator Fund | Bags API | Privacy-focused creator economy protocol, built on smartphone. |
| 7 | CreatorLoop | Bags API | Post-launch tools: organize campaigns, reward supporters, measure traction. |
| 8 | Bags Swarm Analyst | AI Agents | 3 AI agents analyze tokens → P2P consensus → BUY/HOLD/SELL. |
| 9 | BagsAI-Lite | AI Agents | Autonomous AI intelligence layer for creator token ecosystems. |
| 10 | BagScan | Bags API | Discovery, analysis, and launch terminal for Bags ecosystem. |
| 11 | Agro-Energy RWA Exchange | Bags API | RWA tokenization for commodity trade with B2B escrow. |
| 12 | BagsBlitz | AI Agents | AI judges creator pitches before launch, analyzes tokens like a VC. |
| 13 | BagsShield | Privacy | Trust infrastructure — every token, project, community is transparent and verifiable. |
| 14 | BagsFuel | Claude Skills | Auto-claim creator fees → buyback token → reward holders. Growth flywheel. |
| 15 | BagsLaunchKit | AI Agents | AI-generated names, descriptions, marketing content for token launches. |

---

## WINNER PATTERNS FROM OTHER HACKATHONS (proven by analysis of 500+ projects)

From analyzing real winners of Polkadot, Somnia, and GenLayer hackathons:

1. **"Protection/Insurance" framing wins** — Don't present a tool, present a shield. Quote concrete losses: "$100M lost in X, we prevent that."
2. **"Zero bots, zero polling, zero backend"** — Autonomy is a feature, not a detail. Winners emphasized self-operating systems.
3. **Portable on-chain reputation** — 3 different hackathons had winners/HMs building composable reputation layers that other protocols can query.
4. **Pain point with concrete numbers** — Winners describe financial losses they prevent, not features they offer.
5. **Ecosystem-specific capabilities** — Winners exploit something unique to their chain that wouldn't work elsewhere.

---

## QUESTIONS FOR YOU

Based on everything above, please answer these questions:

### Q1: Gap Analysis
What features are MISSING from Sentinel that would be obvious wins given the 9 tracks? Specifically, which tracks does Sentinel currently NOT cover but easily could with 1–3 days of work?

### Q2: Competitive Differentiation
Looking at the 15 competing projects (especially BagsShield, BagScan, Bags Swarm Analyst, and BagsBlitz which overlap with Sentinel), what specific features would make Sentinel clearly superior and differentiated?

### Q3: Claude Skill
Sentinel has no Claude Skill yet, but the hackathon has a dedicated Claude Skills track. What would a killer Sentinel Claude Skill look like? What specific capabilities should it expose? Be very concrete about the skill manifest, tools, and user flows.

### Q4: Social Finance Angle
Sentinel has individual wallet scanning but nothing social. What social features around risk scoring would be compelling? Think: leaderboards, group portfolios, community risk consensus, social sharing.

### Q5: Fee Sharing Innovation
Bags takes 1% on every trade. Sentinel uses this for partner revenue. What creative new ways could Sentinel leverage fee sharing that nobody else is doing?

### Q6: "Ship and Get Traction"
The judging criteria mentions that projects that "ship and get traction" will be rewarded. What specific, measurable traction metrics should Sentinel target in the next 47 days? How do we get real users?

### Q7: Bags-Native Advantage
What features could Sentinel build that ONLY work because of Bags' unique architecture (creator tokens, 1% fee, SDK, fee-share partners)? These would be impossible to build on generic DEXes.

### Q8: The "Wow" Feature
If you had to pick ONE feature that would make judges say "this is clearly top 10", what would it be? Something that demonstrates technical depth AND user impact. Describe it in detail.

### Q9: Missing Integrations
What Solana ecosystem integrations (protocols, wallets, tools) would strengthen Sentinel's position? Think about composability — how can other projects build on top of Sentinel?

### Q10: Risk of Losing
What are the biggest weaknesses in Sentinel right now that could cause it to lose? Be brutally honest. What would the top competitors do better?

---

## FORMAT

For each answer:
1. **Feature name** (short, memorable)
2. **Track fit** (which of the 9 tracks it best serves)
3. **Effort estimate** (days of work: 1, 2–3, 5+, 10+)
4. **Impact score** (1–10, where 10 = judge will remember this)
5. **Implementation sketch** (API endpoints, data flow, key logic)
6. **Why it wins** (1 sentence connecting to winner patterns)
