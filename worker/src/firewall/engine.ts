import { computeRiskScore } from '../risk/engine';
import type { RiskScore } from '../../../shared/types';
import type {
  FirewallDecision,
  FirewallRule,
  FirewallScreenResult,
  FirewallWalletConfig,
  FirewallStats,
  FirewallLogEntry,
} from '../../../shared/types';

// ── KV Keys ──────────────────────────────────────────────

const fwRulesKey   = (wallet: string) => `fw:rules:${wallet}`;
const fwStatsKey   = () => 'fw:stats';
const fwLogKey     = (wallet: string) => `fw:log:${wallet}`;
const alertActiveKey = (mint: string) => `alert:active:${mint}`;

// ── Default config ───────────────────────────────────────

function defaultConfig(wallet: string): FirewallWalletConfig {
  return {
    wallet,
    rules: [],
    autoBlockRug: true,
    autoBlockDanger: false,
    autoBlockLpDrain: true,
    updatedAt: Date.now(),
  };
}

// ── Get / Save wallet config ─────────────────────────────

export async function getWalletConfig(
  wallet: string,
  kv: KVNamespace,
): Promise<FirewallWalletConfig> {
  const raw = await kv.get(fwRulesKey(wallet));
  if (!raw) return defaultConfig(wallet);
  return JSON.parse(raw) as FirewallWalletConfig;
}

async function saveWalletConfig(
  config: FirewallWalletConfig,
  kv: KVNamespace,
): Promise<void> {
  config.updatedAt = Date.now();
  await kv.put(fwRulesKey(config.wallet), JSON.stringify(config), {
    expirationTtl: 86400 * 90,
  });
}

// ── Screen a transaction ─────────────────────────────────

export async function screenTransaction(
  wallet: string,
  tokenMint: string,
  amountUsd: number,
  env: { HELIUS_API_KEY?: string; BIRDEYE_API_KEY?: string; BAGS_API_KEY?: string; SENTINEL_KV?: KVNamespace },
): Promise<FirewallScreenResult> {
  const kv = env.SENTINEL_KV;
  if (!kv) throw new Error('KV not configured');

  // 1. Get risk score
  const risk = await computeRiskScore(tokenMint, env as Parameters<typeof computeRiskScore>[1]);

  // 2. Get wallet config
  const config = await getWalletConfig(wallet, kv);

  const reasons: string[] = [];
  const rulesApplied: string[] = [];
  let decision: FirewallDecision = 'ALLOW';

  // 3. Check user rules first (whitelist overrides everything)
  const matchingRule = config.rules.find(r => r.tokenMint === tokenMint);
  if (matchingRule) {
    if (matchingRule.action === 'whitelist') {
      rulesApplied.push(`User whitelist: ${matchingRule.reason ?? 'manual override'}`);
      // Whitelist — still return risk info but allow
      return {
        decision: 'ALLOW',
        riskScore: risk.score,
        riskTier: risk.tier,
        reasons: ['Whitelisted by user'],
        rulesApplied,
        estimatedRiskUsd: 0,
        screenedAt: Date.now(),
      };
    }
    if (matchingRule.action === 'block') {
      rulesApplied.push(`User blocklist: ${matchingRule.reason ?? 'manual block'}`);
      decision = 'BLOCK';
      reasons.push('Token is on your blocklist');
    }
  }

  // 4. Auto-block rules (only if not already blocked by user rule)
  if (decision !== 'BLOCK') {
    // Rug tier
    if (risk.tier === 'rug' && config.autoBlockRug) {
      decision = 'BLOCK';
      reasons.push(`Rug-tier token (score ${risk.score}/100)`);
      rulesApplied.push('auto-block-rug');
    }

    // Danger tier
    if (risk.tier === 'danger' && config.autoBlockDanger) {
      decision = 'BLOCK';
      reasons.push(`Danger-tier token (score ${risk.score}/100)`);
      rulesApplied.push('auto-block-danger');
    } else if (risk.tier === 'danger' && decision !== 'BLOCK') {
      decision = 'WARN';
      reasons.push(`Danger-tier token (score ${risk.score}/100) — proceed with caution`);
    }

    // Active LP drain alert
    if (config.autoBlockLpDrain) {
      const lpAlert = await kv.get(alertActiveKey(tokenMint));
      if (lpAlert) {
        decision = 'BLOCK';
        reasons.push('Active LP drain detected — possible rug in progress');
        rulesApplied.push('auto-block-lp-drain');
      }
    }

    // Honeypot signal
    if (risk.breakdown.honeypot === 0) {
      if (decision !== 'BLOCK') decision = 'BLOCK';
      reasons.push('Honeypot detected — cannot sell this token');
      rulesApplied.push('honeypot-block');
    }

    // Mint authority not revoked
    if (risk.breakdown.mintAuthority === 0 && decision === 'ALLOW') {
      decision = 'WARN';
      reasons.push('Mint authority active — supply can be inflated');
    }

    // Low liquidity
    if (risk.breakdown.liquidityDepth < 20 && decision === 'ALLOW') {
      decision = 'WARN';
      reasons.push(`Very low liquidity (${risk.breakdown.liquidityDepth}/100)`);
    }

    // Caution tier general warning
    if (risk.tier === 'caution' && decision === 'ALLOW') {
      decision = 'WARN';
      reasons.push(`Caution-tier token (score ${risk.score}/100)`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Safe token (score ${risk.score}/100)`);
  }

  const estimatedRiskUsd = decision === 'ALLOW' ? 0
    : decision === 'WARN' ? amountUsd * 0.3
    : amountUsd;

  const result: FirewallScreenResult = {
    decision,
    riskScore: risk.score,
    riskTier: risk.tier,
    reasons,
    rulesApplied,
    estimatedRiskUsd,
    screenedAt: Date.now(),
  };

  // Fire-and-forget: update stats + log
  updateStats(kv, result, amountUsd).catch(() => {});
  appendLog(kv, wallet, tokenMint, risk, result, amountUsd).catch(() => {});

  return result;
}

// ── Rule management ──────────────────────────────────────

export async function addRule(
  wallet: string,
  rule: Omit<FirewallRule, 'id' | 'createdAt'>,
  kv: KVNamespace,
): Promise<FirewallWalletConfig> {
  const config = await getWalletConfig(wallet, kv);

  // Remove existing rule for same mint (replace)
  config.rules = config.rules.filter(r => r.tokenMint !== rule.tokenMint);

  const newRule: FirewallRule = {
    id: `r_${Date.now().toString(36)}`,
    ...rule,
    createdAt: Date.now(),
  };
  config.rules.push(newRule);

  // Cap at 200 rules per wallet
  if (config.rules.length > 200) {
    config.rules = config.rules.slice(-200);
  }

  await saveWalletConfig(config, kv);
  return config;
}

export async function removeRule(
  wallet: string,
  ruleId: string,
  kv: KVNamespace,
): Promise<FirewallWalletConfig> {
  const config = await getWalletConfig(wallet, kv);
  config.rules = config.rules.filter(r => r.id !== ruleId);
  await saveWalletConfig(config, kv);
  return config;
}

export async function updateSettings(
  wallet: string,
  settings: Partial<Pick<FirewallWalletConfig, 'autoBlockRug' | 'autoBlockDanger' | 'autoBlockLpDrain'>>,
  kv: KVNamespace,
): Promise<FirewallWalletConfig> {
  const config = await getWalletConfig(wallet, kv);
  if (settings.autoBlockRug !== undefined) config.autoBlockRug = settings.autoBlockRug;
  if (settings.autoBlockDanger !== undefined) config.autoBlockDanger = settings.autoBlockDanger;
  if (settings.autoBlockLpDrain !== undefined) config.autoBlockLpDrain = settings.autoBlockLpDrain;
  await saveWalletConfig(config, kv);
  return config;
}

// ── Stats ────────────────────────────────────────────────

export async function getFirewallStats(kv: KVNamespace): Promise<FirewallStats> {
  const raw = await kv.get(fwStatsKey());
  if (!raw) {
    return {
      totalScreened: 0,
      totalBlocked: 0,
      totalWarned: 0,
      estimatedSavedUsd: 0,
      topBlockedTokens: [],
      updatedAt: Date.now(),
    };
  }
  return JSON.parse(raw) as FirewallStats;
}

async function updateStats(
  kv: KVNamespace,
  result: FirewallScreenResult,
  amountUsd: number,
): Promise<void> {
  const stats = await getFirewallStats(kv);
  stats.totalScreened++;
  if (result.decision === 'BLOCK') {
    stats.totalBlocked++;
    stats.estimatedSavedUsd += amountUsd;
  }
  if (result.decision === 'WARN') {
    stats.totalWarned++;
  }
  stats.updatedAt = Date.now();
  await kv.put(fwStatsKey(), JSON.stringify(stats), { expirationTtl: 86400 * 365 });
}

// ── Activity log ─────────────────────────────────────────

async function appendLog(
  kv: KVNamespace,
  wallet: string,
  tokenMint: string,
  risk: RiskScore,
  result: FirewallScreenResult,
  amountUsd: number,
): Promise<void> {
  const raw = await kv.get(fwLogKey(wallet));
  const log: FirewallLogEntry[] = raw ? JSON.parse(raw) : [];

  log.unshift({
    wallet,
    tokenMint,
    tokenSymbol: '', // filled by caller if available
    decision: result.decision,
    riskScore: risk.score,
    riskTier: risk.tier,
    amountUsd,
    reasons: result.reasons,
    screenedAt: result.screenedAt,
  });

  // Keep last 50 entries
  if (log.length > 50) log.length = 50;

  await kv.put(fwLogKey(wallet), JSON.stringify(log), { expirationTtl: 86400 * 30 });
}

export async function getFirewallLog(
  wallet: string,
  kv: KVNamespace,
): Promise<FirewallLogEntry[]> {
  const raw = await kv.get(fwLogKey(wallet));
  return raw ? JSON.parse(raw) as FirewallLogEntry[] : [];
}
