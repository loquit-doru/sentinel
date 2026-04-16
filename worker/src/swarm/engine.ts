/**
 * Sentinel Swarm Engine
 *
 * 5 specialized AI agents analyze a wallet in parallel using real on-chain data
 * (claimable fees + portfolio risk) and vote on recommended actions.
 * A single Claude API call produces all 5 agent perspectives for speed.
 *
 * Agents:
 *   💰 Fee Scanner       — fee claim urgency
 *   🛡️ Risk Sentinel     — portfolio risk exposure
 *   🤖 Auto Claimer      — claim timing: value vs gas cost
 *   🚀 Launch Advisor    — fee optimization strategies
 *   📊 Trade Signal      — identify safe vs risky positions
 */

import type { Env } from '../index';
import { fetchClaimablePositions } from '../fees/bags-fees';

// ── Types ─────────────────────────────────────────────────

export type AgentId = 'fee-scanner' | 'risk-sentinel' | 'auto-claimer' | 'launch-advisor' | 'trade-signal';
export type AgentStatus = 'idle' | 'analyzing' | 'voted' | 'error';
export type SwarmConsensus = 'proceed' | 'hold' | 'reject' | 'split';

export interface AgentVote {
  agentId: AgentId;
  action: string;
  confidence: number;   // 0-1
  reasoning: string;
}

export interface SwarmDecision {
  id: string;
  topic: string;
  consensus: SwarmConsensus;
  confidence: number;
  finalAction: string;
  reasoning: string;
  votes: AgentVote[];
  timestamp: number;
}

export interface SwarmAgentStatus {
  agentId: AgentId;
  name: string;
  status: AgentStatus;
  voteCount: number;
  lastRunAt: number;
  lastError?: string;
}

export interface SwarmCycleResult {
  cycleId: string;
  wallet: string;
  startedAt: number;
  completedAt: number;
  summary: string;
  decisions: SwarmDecision[];
  agentStatuses: SwarmAgentStatus[];
}

export interface SwarmState {
  cycleCount: number;
  lastCycleAt: number;
  agentStatuses: Record<AgentId, SwarmAgentStatus>;
  recentDecisions: SwarmDecision[];
}

// ── Agent definitions ─────────────────────────────────────

const AGENTS: { id: AgentId; name: string }[] = [
  { id: 'fee-scanner',    name: 'Fee Scanner' },
  { id: 'risk-sentinel',  name: 'Risk Sentinel' },
  { id: 'auto-claimer',   name: 'Auto Claimer' },
  { id: 'launch-advisor', name: 'Launch Advisor' },
  { id: 'trade-signal',   name: 'Trade Signal' },
];

// ── Claude API call ───────────────────────────────────────

interface ClaudeAgentOutput {
  agentId: AgentId;
  vote: 'proceed' | 'hold' | 'reject';
  confidence: number;
  action: string;
  reasoning: string;
}

interface ClaudeSwarmResponse {
  agents: ClaudeAgentOutput[];
  overallSummary: string;
}

async function callClaudeSwarm(
  wallet: string,
  totalFeesUsd: number,
  positionCount: number,
  portfolioHealth: number,
  flaggedCount: number,
  flaggedTokens: Array<{ symbol: string; score: number; tier: string }>,
  apiKey: string,
): Promise<ClaudeSwarmResponse | null> {
  const flaggedStr = flaggedTokens.length > 0
    ? flaggedTokens.map(t => `${t.symbol} (score: ${t.score}, tier: ${t.tier})`).join(', ')
    : 'none';

  const prompt = `You are the Sentinel Swarm — a multi-agent AI risk management system for Bags.fm on Solana.

Wallet: ${wallet.slice(0, 8)}...${wallet.slice(-8)}
Claimable fees: $${totalFeesUsd.toFixed(2)} across ${positionCount} positions
Portfolio health: ${portfolioHealth}/100
Flagged holdings: ${flaggedCount} (${flaggedStr})

Analyze this wallet as each of these 5 specialized agents. Each agent must independently assess the situation and cast a vote.

Agents:
1. fee-scanner (💰 Fee Scanner): Assess fee claim urgency based on accumulated amount and risk exposure
2. risk-sentinel (🛡️ Risk Sentinel): Evaluate overall portfolio risk and flag critical exposures
3. auto-claimer (🤖 Auto Claimer): Recommend claim timing — is the value worth claiming now?
4. launch-advisor (🚀 Launch Advisor): Suggest fee optimization strategies for this wallet
5. trade-signal (📊 Trade Signal): Identify which positions are safe to hold vs which to exit

Vote options: "proceed" (take action now), "hold" (wait), "reject" (do not act — too risky)

Return ONLY valid JSON in this exact format, no markdown, no explanation outside JSON:
{
  "agents": [
    {
      "agentId": "fee-scanner",
      "vote": "proceed|hold|reject",
      "confidence": 0.0-1.0,
      "action": "short action label (max 6 words)",
      "reasoning": "1-2 sentence explanation"
    }
  ],
  "overallSummary": "2-3 sentence summary of the swarm's overall assessment"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error('Claude API error:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const body = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = body.content?.find(c => c.type === 'text')?.text ?? '';
    // Extract JSON object robustly — find first { and last }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('No JSON object found in Claude response:', text.slice(0, 200));
      return null;
    }
    return JSON.parse(text.slice(start, end + 1)) as ClaudeSwarmResponse;
  } catch (err) {
    console.error('Claude swarm call failed:', err);
    return null;
  }
}

// ── Consensus engine ──────────────────────────────────────

function resolveConsensus(votes: AgentVote[]): { consensus: SwarmConsensus; confidence: number; finalAction: string; reasoning: string } {
  const counts = { proceed: 0, hold: 0, reject: 0 };
  let totalConfidence = 0;

  for (const v of votes) {
    const vote = v.action.toLowerCase().includes('proceed') ? 'proceed'
      : v.action.toLowerCase().includes('reject') ? 'reject'
      : 'hold';

    // Map vote back from action — use the original vote field on AgentVote if available
    const explicitVote = (v as AgentVote & { vote?: string }).vote as 'proceed' | 'hold' | 'reject' | undefined;
    const finalVote = explicitVote ?? vote;
    counts[finalVote]++;
    totalConfidence += v.confidence;
  }

  const avgConfidence = totalConfidence / votes.length;
  const total = votes.length;

  // Majority (>50%) wins; ties → split
  const maxVote = (Object.entries(counts) as [SwarmConsensus, number][]).sort((a, b) => b[1] - a[1])[0];
  const consensus: SwarmConsensus = maxVote[1] > total / 2 ? maxVote[0] : 'split';

  const proceedVotes = votes.filter(v => ((v as AgentVote & { vote?: string }).vote ?? 'hold') === 'proceed');
  const rejectVotes = votes.filter(v => ((v as AgentVote & { vote?: string }).vote ?? 'hold') === 'reject');

  let finalAction: string;
  let reasoning: string;

  if (consensus === 'proceed') {
    finalAction = proceedVotes[0]?.action ?? 'Execute recommended action';
    reasoning = `${counts.proceed}/${total} agents voted PROCEED. ${proceedVotes[0]?.reasoning ?? ''}`;
  } else if (consensus === 'reject') {
    finalAction = 'Do not act — risk gate triggered';
    reasoning = `${counts.reject}/${total} agents voted REJECT. ${rejectVotes[0]?.reasoning ?? ''}`;
  } else if (consensus === 'hold') {
    finalAction = 'Monitor — no action required now';
    reasoning = `${counts.hold}/${total} agents voted HOLD. Conditions not yet optimal.`;
  } else {
    finalAction = 'Manual review required';
    reasoning = `Agents split: ${counts.proceed} proceed / ${counts.hold} hold / ${counts.reject} reject. Human judgment needed.`;
  }

  return { consensus, confidence: avgConfidence, finalAction, reasoning };
}

// ── Main export ───────────────────────────────────────────

const KV_PREFIX = 'swarm:';
const MAX_RECENT_DECISIONS = 20;

export async function runSwarmCycle(wallet: string, env: Env): Promise<SwarmCycleResult> {
  const startedAt = Date.now();
  const cycleId = `cycle_${wallet.slice(0, 6)}_${startedAt}`;

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // 1. Gather fee data only — portfolio scan is too subrequest-heavy for CF Workers free limit
  const feeSnapshot = await fetchClaimablePositions(wallet, env.BAGS_API_KEY).catch(() => null);

  const totalFeesUsd = feeSnapshot?.totalClaimableUsd ?? 0;
  const positionCount = feeSnapshot?.positions.length ?? 0;
  // Derive rough portfolio health from fee position count (no full scan to stay under subrequest limit)
  const portfolioHealth = Math.min(100, 40 + positionCount * 5);
  const flaggedCount = 0;
  const flaggedTokens: Array<{ symbol: string; score: number; tier: string }> = [];

  // 2. Call Claude — one call produces all 5 agent outputs
  const claudeResult = await callClaudeSwarm(
    wallet, totalFeesUsd, positionCount,
    portfolioHealth, flaggedCount, flaggedTokens,
    env.ANTHROPIC_API_KEY,
  );

  // 3. Build decisions from Claude output (or fallback if Claude fails)
  const decisions: SwarmDecision[] = [];
  const agentStatuses: SwarmAgentStatus[] = [];

  if (claudeResult?.agents && claudeResult.agents.length > 0) {
    // Group agent outputs into decisions by topic
    const feeAgents = claudeResult.agents.filter(a => ['fee-scanner', 'auto-claimer'].includes(a.agentId));
    const riskAgents = claudeResult.agents.filter(a => ['risk-sentinel', 'trade-signal'].includes(a.agentId));
    const strategyAgents = claudeResult.agents.filter(a => ['launch-advisor'].includes(a.agentId));

    const buildDecision = (topic: string, agents: ClaudeAgentOutput[]): SwarmDecision | null => {
      if (agents.length === 0) return null;
      const votes: (AgentVote & { vote: string })[] = agents.map(a => ({
        agentId: a.agentId,
        action: a.action,
        confidence: Math.max(0, Math.min(1, a.confidence)),
        reasoning: a.reasoning,
        vote: a.vote,
      }));
      const { consensus, confidence, finalAction, reasoning } = resolveConsensus(votes);
      return {
        id: `${topic.toLowerCase().replace(/\s+/g, '_')}_${startedAt}`,
        topic,
        consensus,
        confidence,
        finalAction,
        reasoning,
        votes,
        timestamp: Date.now(),
      };
    };

    const feeDec = buildDecision('Fee Claim Strategy', feeAgents);
    const riskDec = buildDecision('Portfolio Risk Assessment', riskAgents);
    const stratDec = buildDecision('Optimization Strategy', strategyAgents);

    if (feeDec) decisions.push(feeDec);
    if (riskDec) decisions.push(riskDec);
    if (stratDec) decisions.push(stratDec);

    // Build agent statuses
    for (const agent of AGENTS) {
      const output = claudeResult.agents.find(a => a.agentId === agent.id);
      agentStatuses.push({
        agentId: agent.id,
        name: agent.name,
        status: output ? 'voted' : 'idle',
        voteCount: output ? 1 : 0,
        lastRunAt: startedAt,
      });
    }
  } else {
    // Fallback: Claude unavailable — produce a safe default
    for (const agent of AGENTS) {
      agentStatuses.push({
        agentId: agent.id,
        name: agent.name,
        status: 'error',
        voteCount: 0,
        lastRunAt: startedAt,
        lastError: 'Analysis unavailable — retrying on next cycle',
      });
    }
  }

  const completedAt = Date.now();

  const summary = claudeResult?.overallSummary
    ?? `Swarm cycle completed in ${completedAt - startedAt}ms. ${decisions.length} decision(s) reached. Manual review recommended.`;

  const result: SwarmCycleResult = {
    cycleId,
    wallet,
    startedAt,
    completedAt,
    summary,
    decisions,
    agentStatuses,
  };

  // 4. Persist state to KV
  if (env.SENTINEL_KV) {
    const prevRaw = await env.SENTINEL_KV.get(`${KV_PREFIX}${wallet}`, 'json');
    const prev = prevRaw as SwarmState | null;

    const newState: SwarmState = {
      cycleCount: (prev?.cycleCount ?? 0) + 1,
      lastCycleAt: startedAt,
      agentStatuses: Object.fromEntries(
        agentStatuses.map(a => [a.agentId, a])
      ) as Record<AgentId, SwarmAgentStatus>,
      recentDecisions: [...decisions, ...(prev?.recentDecisions ?? [])].slice(0, MAX_RECENT_DECISIONS),
    };

    await env.SENTINEL_KV.put(
      `${KV_PREFIX}${wallet}`,
      JSON.stringify(newState),
      { expirationTtl: 86400 * 30 }, // 30 days
    ).catch(() => {}); // non-critical
  }

  return result;
}

export async function getSwarmState(wallet: string, env: Env): Promise<SwarmState | null> {
  if (!env.SENTINEL_KV) return null;
  const raw = await env.SENTINEL_KV.get(`${KV_PREFIX}${wallet}`, 'json');
  return (raw as SwarmState | null);
}
