/**
 * Risk Alert Scanner
 *
 * Scans top Bags tokens, compares current risk scores to previous scores
 * stored in KV, and generates alerts when significant changes occur.
 *
 * Design: stateless function, KV for persistence. Called by:
 *   - Cron trigger (scheduled every 15 min)
 *   - On-demand via GET /v1/alerts/scan (rate-limited)
 */

import type { Env } from '../index';
import type { RiskAlert, AlertType, AlertSeverity, RiskTier } from '../../../shared/types';
import { tierFromScore } from '../../../shared/types';
import { fetchTopTokens } from '../feed/bags';
import { computeRiskScore } from '../risk/engine';
import { fetchRugCheckReport, analyzeRugCheck } from '../risk/rugcheck';

const ALERT_KV_PREFIX = 'alert:';
const SCORE_KV_PREFIX = 'score:prev:';
const FEED_KEY = 'alerts:feed';
const SCAN_META_KEY = 'alerts:scan:meta';

// Max tokens to scan per run (kept conservative to preserve KV quota)
const MAX_SCAN_BATCH = 10;
// Max alerts to keep in feed (rolling window)
const MAX_ALERTS = 100;
// Score change threshold to generate alert (absolute points)
const SCORE_CHANGE_THRESHOLD = 15;
// Top holder concentration spike threshold (percentage points)
const HOLDER_SPIKE_THRESHOLD = 20;
// LP drain thresholds (% drop in totalMarketLiquidity between scans)
const LP_DRAIN_CRITICAL_PCT = 20; // ≥20% drop → CRITICAL
const LP_DRAIN_WARNING_PCT = 10;  // ≥10% drop → WARNING
// Minimum liquidity to track (ignore micro-pools)
const LP_DRAIN_MIN_USD = 500;

interface PreviousScore {
  score: number;
  tier: RiskTier;
  lpLocked: number;
  topHolderPct: number;
  mintAuthority: number;
  liquidityUsd: number;  // totalMarketLiquidity from RugCheck (only stored when > 0)
  lpDrainConfirmCount: number; // consecutive scans showing drain (debounce)
  timestamp: number;
}

interface ScanMeta {
  lastScanAt: number;
  scannedTokens: number;
  alertsGenerated: number;
}

/**
 * Run a full scan: fetch top tokens, score them, compare to previous, emit alerts.
 * Returns the new alerts generated in this run.
 */
export async function runAlertScan(env: Env): Promise<RiskAlert[]> {
  const kv = env.SENTINEL_KV;
  if (!kv) return [];

  // 1. Get top tokens from Bags
  const tokens = await fetchTopTokens(env.BAGS_API_KEY);
  const batch = tokens.slice(0, MAX_SCAN_BATCH);
  if (batch.length === 0) return [];

  const newAlerts: RiskAlert[] = [];

  // 2. Score each token and compare to previous
  const scoringResults = await Promise.allSettled(
    batch.map(async (token) => {
      try {
        // Current score
        const current = await computeRiskScore(token.mint, {
          HELIUS_API_KEY: env.HELIUS_API_KEY,
          BIRDEYE_API_KEY: env.BIRDEYE_API_KEY,
        });

        // Previous score from KV
        const prevRaw = await kv.get(`${SCORE_KV_PREFIX}${token.mint}`, 'json');
        const prev = prevRaw as PreviousScore | null;

        // Get RugCheck for creator + LP details
        const rugReport = await fetchRugCheckReport(token.mint);
        const creatorWallet = rugReport?.creator ?? null;

        // --- Generate alerts ---

        // Tier change
        if (prev && prev.tier !== current.tier) {
          const degraded = tierRank(current.tier) < tierRank(prev.tier);
          newAlerts.push({
            id: `tier_${token.mint}_${Date.now()}`,
            mint: token.mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            type: 'tier_change',
            severity: degraded ? (current.tier === 'rug' ? 'critical' : 'warning') : 'info',
            title: `${token.symbol} moved from ${prev.tier.toUpperCase()} to ${current.tier.toUpperCase()}`,
            description: degraded
              ? `Risk score dropped from ${prev.score} to ${current.score}. Review this token immediately.`
              : `Risk score improved from ${prev.score} to ${current.score}.`,
            previousScore: prev.score,
            currentScore: current.score,
            previousTier: prev.tier,
            currentTier: current.tier,
            timestamp: Date.now(),
            creatorWallet,
          });
        }
        // Significant score change (same tier but big move)
        else if (prev && Math.abs(current.score - prev.score) >= SCORE_CHANGE_THRESHOLD) {
          const degraded = current.score < prev.score;
          newAlerts.push({
            id: `score_${token.mint}_${Date.now()}`,
            mint: token.mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            type: 'tier_change',
            severity: degraded ? 'warning' : 'info',
            title: `${token.symbol} score ${degraded ? 'dropped' : 'improved'}: ${prev.score} → ${current.score}`,
            description: `Significant ${degraded ? 'decline' : 'improvement'} in risk score within the same tier (${current.tier}).`,
            previousScore: prev.score,
            currentScore: current.score,
            previousTier: prev.tier,
            currentTier: current.tier,
            timestamp: Date.now(),
            creatorWallet,
          });
        }

        // LP unlock detection
        if (prev && prev.lpLocked > 50 && current.breakdown.lpLocked < 20) {
          newAlerts.push({
            id: `lp_${token.mint}_${Date.now()}`,
            mint: token.mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            type: 'lp_unlock',
            severity: 'critical',
            title: `⚠️ ${token.symbol} LP appears UNLOCKED`,
            description: `LP locked score dropped from ${prev.lpLocked} to ${current.breakdown.lpLocked}. Liquidity may be at risk of removal.`,
            previousScore: prev.score,
            currentScore: current.score,
            previousTier: prev.tier,
            currentTier: current.tier,
            timestamp: Date.now(),
            creatorWallet,
          });
        }

        // LP drain detection — tracks actual USD liquidity draining in real-time
        // Requires 2 consecutive scans showing drain before firing CRITICAL (debounce API noise)
        const currentLiquidityUsd = rugReport?.totalMarketLiquidity ?? 0;
        if (
          prev &&
          prev.liquidityUsd >= LP_DRAIN_MIN_USD &&
          currentLiquidityUsd < prev.liquidityUsd
        ) {
          const dropPct = ((prev.liquidityUsd - currentLiquidityUsd) / prev.liquidityUsd) * 100;
          const confirmCount = (prev.lpDrainConfirmCount ?? 0) + 1;

          if (dropPct >= LP_DRAIN_CRITICAL_PCT) {
            if (confirmCount >= 2) {
              // Confirmed over 2+ scans — real drain
              newAlerts.push({
                id: `drain_${token.mint}_${Date.now()}`,
                mint: token.mint,
                tokenName: token.name,
                tokenSymbol: token.symbol,
                type: 'lp_drain',
                severity: 'critical',
                title: `🚨 ${token.symbol} LP DRAINING — -${dropPct.toFixed(1)}% liquidity`,
                description: `Liquidity dropped from $${prev.liquidityUsd.toLocaleString()} to $${currentLiquidityUsd.toLocaleString()} (-${dropPct.toFixed(1)}%) since last scan. Possible rug in progress — exit window closing.`,
                previousScore: prev.score,
                currentScore: current.score,
                previousTier: prev.tier,
                currentTier: current.tier,
                timestamp: Date.now(),
                creatorWallet,
                liquidityUsd: currentLiquidityUsd,
                prevLiquidityUsd: prev.liquidityUsd,
                liquidityDropPct: dropPct,
              });
            } else {
              // First detection — fire WARNING only (possible API noise)
              newAlerts.push({
                id: `drain_${token.mint}_${Date.now()}`,
                mint: token.mint,
                tokenName: token.name,
                tokenSymbol: token.symbol,
                type: 'lp_drain',
                severity: 'warning',
                title: `⚠️ ${token.symbol} LP may be draining — -${dropPct.toFixed(1)}% (unconfirmed)`,
                description: `Liquidity dropped from $${prev.liquidityUsd.toLocaleString()} to $${currentLiquidityUsd.toLocaleString()} (-${dropPct.toFixed(1)}%). Monitoring next scan to confirm.`,
                previousScore: prev.score,
                currentScore: current.score,
                previousTier: prev.tier,
                currentTier: current.tier,
                timestamp: Date.now(),
                creatorWallet,
                liquidityUsd: currentLiquidityUsd,
                prevLiquidityUsd: prev.liquidityUsd,
                liquidityDropPct: dropPct,
              });
            }
          } else if (dropPct >= LP_DRAIN_WARNING_PCT) {
            newAlerts.push({
              id: `drain_${token.mint}_${Date.now()}`,
              mint: token.mint,
              tokenName: token.name,
              tokenSymbol: token.symbol,
              type: 'lp_drain',
              severity: 'warning',
              title: `⚠️ ${token.symbol} liquidity dropping — -${dropPct.toFixed(1)}%`,
              description: `Liquidity dropped from $${prev.liquidityUsd.toLocaleString()} to $${currentLiquidityUsd.toLocaleString()} (-${dropPct.toFixed(1)}%) since last scan. Monitor closely.`,
              previousScore: prev.score,
              currentScore: current.score,
              previousTier: prev.tier,
              currentTier: current.tier,
              timestamp: Date.now(),
              creatorWallet,
              liquidityUsd: currentLiquidityUsd,
              prevLiquidityUsd: prev.liquidityUsd,
              liquidityDropPct: dropPct,
            });
          }
        }

        // Top holder concentration spike
        if (prev) {
          // topHolderPct in breakdown is inverted (100 = good distribution)
          // So a DROP in this value means concentration INCREASED
          const prevDistribution = prev.topHolderPct;
          const currDistribution = current.breakdown.topHolderPct;
          if (prevDistribution - currDistribution >= HOLDER_SPIKE_THRESHOLD) {
            newAlerts.push({
              id: `holder_${token.mint}_${Date.now()}`,
              mint: token.mint,
              tokenName: token.name,
              tokenSymbol: token.symbol,
              type: 'holder_spike',
              severity: 'warning',
              title: `${token.symbol}: Top holder concentration increased sharply`,
              description: `Holder distribution score dropped from ${prevDistribution} to ${currDistribution}. Whales may be accumulating.`,
              previousScore: prev.score,
              currentScore: current.score,
              previousTier: prev.tier,
              currentTier: current.tier,
              timestamp: Date.now(),
              creatorWallet,
            });
          }
        }

        // New token scored danger/rug on first scan
        if (!prev && (current.tier === 'danger' || current.tier === 'rug')) {
          newAlerts.push({
            id: `new_${token.mint}_${Date.now()}`,
            mint: token.mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            type: 'new_danger',
            severity: current.tier === 'rug' ? 'critical' : 'warning',
            title: `New token ${token.symbol} scored ${current.tier.toUpperCase()} (${current.score})`,
            description: `First scan of ${token.name} shows ${current.tier}-level risk. Exercise extreme caution.`,
            previousScore: null,
            currentScore: current.score,
            previousTier: null,
            currentTier: current.tier,
            timestamp: Date.now(),
            creatorWallet,
          });
        }

        // Save current score as "previous" for next scan
        // Note: only update liquidityUsd if we got real data (> 0) to avoid storing API noise
        const realLiquidityUsd = (rugReport?.totalMarketLiquidity ?? 0) > 0
          ? rugReport!.totalMarketLiquidity
          : (prev?.liquidityUsd ?? 0);

        // Compute drain confirm count: increment if draining, reset if recovered
        const currentLiquidity = rugReport?.totalMarketLiquidity ?? 0;
        const isDraining = prev && prev.liquidityUsd >= LP_DRAIN_MIN_USD && currentLiquidity < prev.liquidityUsd &&
          ((prev.liquidityUsd - currentLiquidity) / prev.liquidityUsd) * 100 >= LP_DRAIN_CRITICAL_PCT;
        const lpDrainConfirmCount = isDraining ? (prev?.lpDrainConfirmCount ?? 0) + 1 : 0;

        const newPrev: PreviousScore = {
          score: current.score,
          tier: current.tier,
          lpLocked: current.breakdown.lpLocked,
          topHolderPct: current.breakdown.topHolderPct,
          mintAuthority: current.breakdown.mintAuthority,
          liquidityUsd: realLiquidityUsd,
          lpDrainConfirmCount,
          timestamp: Date.now(),
        };
        const changed =
          !prev ||
          prev.score !== newPrev.score ||
          prev.tier !== newPrev.tier ||
          prev.lpLocked !== newPrev.lpLocked ||
          prev.topHolderPct !== newPrev.topHolderPct ||
          prev.mintAuthority !== newPrev.mintAuthority ||
          prev.lpDrainConfirmCount !== newPrev.lpDrainConfirmCount ||
          Math.abs((prev.liquidityUsd ?? 0) - newPrev.liquidityUsd) > 10; // save if liquidity changed >$10

        if (changed) {
          await kv.put(
            `${SCORE_KV_PREFIX}${token.mint}`,
            JSON.stringify(newPrev),
            { expirationTtl: 86400 * 7 }, // 7 days
          );
        }
      } catch (err) {
        console.error(`Alert scan failed for ${token.mint}:`, err);
      }
    }),
  );

  // 3. Merge new alerts into existing feed (rolling window)
  const existingRaw = await kv.get(FEED_KEY, 'json');
  const existingAlerts = (existingRaw as RiskAlert[] | null) ?? [];
  const mergedAlerts = [...newAlerts, ...existingAlerts].slice(0, MAX_ALERTS);

  if (newAlerts.length > 0) {
    await kv.put(FEED_KEY, JSON.stringify(mergedAlerts), {
      expirationTtl: 86400 * 3, // 3 days
    });
  }

  // 4. Save scan metadata
  const meta: ScanMeta = {
    lastScanAt: Date.now(),
    scannedTokens: batch.length,
    alertsGenerated: newAlerts.length,
  };
  const prevMetaRaw = await kv.get(SCAN_META_KEY, 'json');
  const prevMeta = prevMetaRaw as ScanMeta | null;
  const metaChanged =
    !prevMeta ||
    prevMeta.scannedTokens !== meta.scannedTokens ||
    prevMeta.alertsGenerated !== meta.alertsGenerated;

  if (metaChanged || newAlerts.length > 0) {
    await kv.put(SCAN_META_KEY, JSON.stringify(meta), { expirationTtl: 86400 });
  }

  return newAlerts;
}

/**
 * Get the current alert feed from KV.
 */
export async function getAlertFeed(kv: KVNamespace): Promise<{
  alerts: RiskAlert[];
  scannedTokens: number;
  lastScanAt: number;
}> {
  const [alertsRaw, metaRaw] = await Promise.all([
    kv.get(FEED_KEY, 'json'),
    kv.get(SCAN_META_KEY, 'json'),
  ]);

  const alerts = (alertsRaw as RiskAlert[] | null) ?? [];
  const meta = (metaRaw as ScanMeta | null) ?? { lastScanAt: 0, scannedTokens: 0, alertsGenerated: 0 };

  return {
    alerts,
    scannedTokens: meta.scannedTokens,
    lastScanAt: meta.lastScanAt,
  };
}

/** Convert tier to numeric rank for comparison (higher = safer) */
function tierRank(tier: RiskTier): number {
  switch (tier) {
    case 'safe': return 4;
    case 'caution': return 3;
    case 'danger': return 2;
    case 'rug': return 1;
  }
}
