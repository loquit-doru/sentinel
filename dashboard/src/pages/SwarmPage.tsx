import { useState, useEffect } from 'react';
import type { SwarmCycleData, SwarmAgentStatus, SwarmDecisionData, SwarmConsensus, AgentId } from '../api';
import { runSwarmCycle, fetchSwarmState } from '../api';

// ── Agent metadata ────────────────────────────────────────

const AGENT_META: Record<AgentId, { icon: string; color: string }> = {
  'fee-scanner':    { icon: '💰', color: 'text-yellow-400' },
  'risk-sentinel':  { icon: '🛡️', color: 'text-sentinel-danger' },
  'auto-claimer':   { icon: '🤖', color: 'text-sentinel-accent' },
  'launch-advisor': { icon: '🚀', color: 'text-purple-400' },
  'trade-signal':   { icon: '📊', color: 'text-sentinel-safe' },
};

const CONSENSUS_STYLES: Record<SwarmConsensus, { label: string; bg: string; text: string; border: string }> = {
  proceed: { label: 'PROCEED', bg: 'bg-sentinel-safe/10',   text: 'text-sentinel-safe',   border: 'border-sentinel-safe/30' },
  hold:    { label: 'HOLD',    bg: 'bg-sentinel-caution/10', text: 'text-sentinel-caution', border: 'border-sentinel-caution/30' },
  reject:  { label: 'REJECT',  bg: 'bg-sentinel-danger/10', text: 'text-sentinel-danger',  border: 'border-sentinel-danger/30' },
  split:   { label: 'SPLIT',   bg: 'bg-gray-700/30',        text: 'text-gray-400',         border: 'border-gray-600/30' },
};

const STATUS_STYLES: Record<SwarmAgentStatus['status'], { dot: string; label: string }> = {
  idle:      { dot: 'bg-gray-600',          label: 'Idle' },
  analyzing: { dot: 'bg-sentinel-accent animate-pulse', label: 'Analyzing…' },
  voted:     { dot: 'bg-sentinel-safe',     label: 'Voted' },
  error:     { dot: 'bg-sentinel-danger',   label: 'Error' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Agent status card ─────────────────────────────────────

function AgentCard({ agent }: { agent: SwarmAgentStatus }) {
  const meta = AGENT_META[agent.agentId];
  const st = STATUS_STYLES[agent.status];

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      agent.status === 'voted'
        ? 'border-sentinel-safe/20 bg-sentinel-safe/3'
        : agent.status === 'error'
        ? 'border-sentinel-danger/20 bg-sentinel-danger/3'
        : 'border-sentinel-border/40 bg-sentinel-surface/30'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <span className="text-sm font-medium text-white">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{st.label}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{agent.voteCount > 0 ? `${agent.voteCount} vote${agent.voteCount !== 1 ? 's' : ''}` : 'No votes yet'}</span>
        {agent.lastRunAt > 0 && <span>{timeAgo(agent.lastRunAt)}</span>}
      </div>
      {agent.lastError && (
        <p className="text-[10px] text-sentinel-danger mt-1 truncate">{agent.lastError}</p>
      )}
    </div>
  );
}

// ── Decision card ─────────────────────────────────────────

function DecisionCard({ decision }: { decision: SwarmDecisionData }) {
  const [expanded, setExpanded] = useState(false);
  const cs = CONSENSUS_STYLES[decision.consensus];
  const confidencePct = Math.round(decision.confidence * 100);

  return (
    <div className={`rounded-xl border ${cs.border} bg-sentinel-surface/20 overflow-hidden`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{decision.topic}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{decision.finalAction}</p>
          </div>
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-bold tracking-wider ${cs.bg} ${cs.text} ${cs.border}`}>
            {cs.label}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>Confidence</span>
            <span className={cs.text}>{confidencePct}%</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                decision.consensus === 'proceed' ? 'bg-sentinel-safe'
                : decision.consensus === 'reject' ? 'bg-sentinel-danger'
                : decision.consensus === 'hold'   ? 'bg-sentinel-caution'
                : 'bg-gray-600'
              }`}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">{decision.reasoning}</p>

        {/* Vote breakdown toggle */}
        {decision.votes.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 text-[11px] text-sentinel-accent hover:underline flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Show'} agent votes ({decision.votes.length})
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Expanded votes */}
      {expanded && decision.votes.length > 0 && (
        <div className="border-t border-sentinel-border/30 divide-y divide-sentinel-border/20">
          {decision.votes.map(vote => {
            const meta = AGENT_META[vote.agentId];
            return (
              <div key={vote.agentId} className="px-4 py-3 flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{meta?.icon ?? '🤖'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-300">{vote.action}</span>
                    <span className="text-[10px] text-gray-600">{Math.round(vote.confidence * 100)}%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{vote.reasoning}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Cycle summary bar ─────────────────────────────────────

function CycleSummary({ result }: { result: SwarmCycleData }) {
  const durationMs = result.completedAt - result.startedAt;
  const votes = result.agentStatuses;
  const proceeded = result.decisions.filter(d => d.consensus === 'proceed').length;
  const held      = result.decisions.filter(d => d.consensus === 'hold').length;
  const rejected  = result.decisions.filter(d => d.consensus === 'reject').length;

  return (
    <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-mono truncate">{result.cycleId}</span>
        <span className="text-gray-600 shrink-0 ml-2">{durationMs}ms</span>
      </div>

      {/* Decision tally */}
      <div className="flex items-center gap-4 text-xs">
        {proceeded > 0 && <span className="text-sentinel-safe font-medium">{proceeded} proceed</span>}
        {held > 0      && <span className="text-sentinel-caution font-medium">{held} hold</span>}
        {rejected > 0  && <span className="text-sentinel-danger font-medium">{rejected} reject</span>}
        <span className="text-gray-600 ml-auto">{votes.filter(v => v.status === 'voted').length}/{votes.length} agents voted</span>
      </div>

      {/* Summary text */}
      <p className="text-xs text-gray-400 leading-relaxed border-t border-sentinel-border/20 pt-3">
        {result.summary}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export function SwarmPage({ connectedWallet }: { connectedWallet: string | null }) {
  const [wallet, setWallet] = useState(connectedWallet ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SwarmCycleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycleCount, setCycleCount] = useState<number | null>(null);

  // Pre-fill connected wallet
  useEffect(() => {
    if (connectedWallet && !wallet) setWallet(connectedWallet);
  }, [connectedWallet]);

  // Load prior cycle count
  useEffect(() => {
    if (!wallet || wallet.length < 32) return;
    fetchSwarmState(wallet).then(state => {
      if (state) setCycleCount(state.cycleCount);
    });
  }, [wallet]);

  const handleRun = async () => {
    if (!wallet || wallet.length < 32) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const data = await runSwarmCycle(wallet);
      setResult(data);
      setCycleCount(c => (c ?? 0) + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swarm cycle failed');
    } finally {
      setRunning(false);
    }
  };

  // Spinner agents while running
  const pendingAgents: SwarmAgentStatus[] = [
    { agentId: 'fee-scanner',    name: 'Fee Scanner',    status: 'analyzing', voteCount: 0, lastRunAt: 0 },
    { agentId: 'risk-sentinel',  name: 'Risk Sentinel',  status: 'analyzing', voteCount: 0, lastRunAt: 0 },
    { agentId: 'auto-claimer',   name: 'Auto Claimer',   status: 'analyzing', voteCount: 0, lastRunAt: 0 },
    { agentId: 'launch-advisor', name: 'Launch Advisor', status: 'analyzing', voteCount: 0, lastRunAt: 0 },
    { agentId: 'trade-signal',   name: 'Trade Signal',   status: 'analyzing', voteCount: 0, lastRunAt: 0 },
  ];

  const displayAgents = running ? pendingAgents : result?.agentStatuses ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          AI Swarm Intelligence
          <span className="text-xs font-normal text-gray-500 px-2 py-0.5 rounded-full border border-sentinel-border/50">Beta</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          5 specialized AI agents analyze your wallet in parallel — fee urgency, risk exposure, claim timing,
          optimization strategies, and trade signals. One swarm call, five perspectives.
        </p>
      </div>

      {/* Input */}
      <div className="p-4 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-3">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Wallet to analyze</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={wallet}
            onChange={e => setWallet(e.target.value.trim())}
            placeholder="Solana wallet address…"
            spellCheck={false}
            disabled={running}
            className="flex-1 bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sentinel-accent/50 font-mono disabled:opacity-50"
          />
          <button
            onClick={handleRun}
            disabled={running || !wallet}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              running
                ? 'bg-sentinel-accent/20 text-sentinel-accent/60 cursor-wait'
                : 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-sentinel-accent border-t-transparent rounded-full animate-spin" />
                Running…
              </span>
            ) : 'Run Swarm'}
          </button>
        </div>
        {cycleCount !== null && (
          <p className="text-[11px] text-gray-600">{cycleCount} previous cycle{cycleCount !== 1 ? 's' : ''} for this wallet</p>
        )}
        {connectedWallet && wallet !== connectedWallet && (
          <button
            onClick={() => setWallet(connectedWallet)}
            className="text-[11px] text-sentinel-accent hover:underline"
          >
            Use connected wallet →
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      )}

      {/* Agent status grid */}
      {(running || displayAgents.length > 0) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayAgents.map(agent => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Cycle summary */}
      {result && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cycle Summary</h3>
          <CycleSummary result={result} />
        </div>
      )}

      {/* Decisions */}
      {result && result.decisions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Swarm Decisions ({result.decisions.length})
          </h3>
          <div className="space-y-3">
            {result.decisions.map(decision => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </div>
        </div>
      )}

      {/* Empty result state */}
      {result && result.decisions.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <p className="text-gray-500 text-sm">No decisions reached — agents may have been unable to gather data.</p>
          <p className="text-gray-600 text-xs">Check that ANTHROPIC_API_KEY is configured on the worker.</p>
        </div>
      )}

      {/* Idle state */}
      {!running && !result && !error && (
        <div className="text-center py-14 space-y-3">
          <div className="flex justify-center gap-1 text-2xl">
            {Object.values(AGENT_META).map((m, i) => (
              <span key={i} className="opacity-70">{m.icon}</span>
            ))}
          </div>
          <p className="text-gray-400 text-sm font-medium">5 agents ready</p>
          <p className="text-gray-600 text-xs max-w-sm mx-auto">
            Enter a Solana wallet address and run the swarm to get a parallel multi-agent risk analysis with consensus voting.
          </p>
        </div>
      )}

      <p className="text-center text-[10px] text-gray-700 pt-2">
        Powered by Claude Haiku · Real on-chain data · Fee data from Bags.fm · Risk data from RugCheck
      </p>
    </div>
  );
}
