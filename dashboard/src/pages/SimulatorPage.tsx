import { useState } from 'react';
import { simulateRugScenarios } from '../api';
import type { RugSimulationResult, ScenarioResult } from '../api';

const SCENARIO_ICONS: Record<string, string> = {
  lp_pull: '💧',
  mint_exploit: '🔑',
  whale_dump: '🐋',
  freeze_attack: '🧊',
  slow_rug: '🐌',
  honeypot_activate: '🍯',
};

const SCENARIO_LABELS: Record<string, string> = {
  lp_pull: 'LP Pull',
  mint_exploit: 'Mint Exploit',
  whale_dump: 'Whale Dump',
  freeze_attack: 'Freeze Attack',
  slow_rug: 'Slow Rug',
  honeypot_activate: 'Honeypot',
};

const PROB_COLORS: Record<string, string> = {
  low: 'text-sentinel-safe border-sentinel-safe/30 bg-sentinel-safe/10',
  medium: 'text-sentinel-caution border-sentinel-caution/30 bg-sentinel-caution/10',
  high: 'text-sentinel-danger border-sentinel-danger/30 bg-sentinel-danger/10',
  critical: 'text-sentinel-rug border-sentinel-rug/30 bg-sentinel-rug/10',
};

function ProbBadge({ prob }: { prob: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PROB_COLORS[prob] ?? 'text-gray-400'}`}>
      {prob}
    </span>
  );
}

function OverallRiskBar({ risk }: { risk: string }) {
  const w = risk === 'critical' ? 100 : risk === 'high' ? 75 : risk === 'medium' ? 50 : 25;
  const color = risk === 'critical' ? 'bg-sentinel-rug' : risk === 'high' ? 'bg-sentinel-danger' : risk === 'medium' ? 'bg-sentinel-caution' : 'bg-sentinel-safe';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500 uppercase tracking-wider">Overall Risk</span>
        <span className={`font-bold uppercase ${PROB_COLORS[risk]?.split(' ')[0] ?? 'text-gray-400'}`}>{risk}</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function ScenarioCard({ s, expanded, onToggle }: { s: ScenarioResult; expanded: boolean; onToggle: () => void }) {
  const icon = SCENARIO_ICONS[s.scenario] ?? '⚠️';
  const label = SCENARIO_LABELS[s.scenario] ?? s.scenario;

  return (
    <div
      className={`rounded-xl border transition-all ${
        s.applicable
          ? `border-sentinel-border/50 bg-sentinel-surface/20 hover:border-sentinel-border/70`
          : 'border-sentinel-border/20 bg-sentinel-surface/10 opacity-50'
      }`}
    >
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{label}</span>
            {s.applicable ? <ProbBadge prob={s.probability} /> : (
              <span className="text-[10px] text-gray-600 border border-gray-700 rounded-full px-2 py-0.5">N/A</span>
            )}
          </div>
          {s.applicable && (
            <p className="text-[10px] text-gray-500 mt-0.5">
              Est. loss: <span className="text-sentinel-danger font-bold">{s.estimatedLossPct}%</span> · Timeframe: {s.estimatedTimeframe}
            </p>
          )}
        </div>
        <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-sentinel-border/20 pt-3">
          <p className="text-sm text-gray-300">{s.explanation}</p>
          {s.mitigations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Mitigations</p>
              {s.mitigations.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="text-sentinel-accent mt-0.5">→</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SimulatorPage({ onViewToken }: { onViewToken: (mint: string) => void }) {
  const [mint, setMint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RugSimulationResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const doSimulate = async () => {
    const trimmed = mint.trim();
    if (!SOLANA_RE.test(trimmed)) { setError('Enter a valid Solana token mint'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    setExpanded(new Set());
    try {
      const sim = await simulateRugScenarios(trimmed);
      setResult(sim);
      // Auto-expand applicable scenarios
      const auto = new Set(sim.scenarios.filter(s => s.applicable).map(s => s.scenario));
      setExpanded(auto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    }
    setLoading(false);
  };

  const toggle = (scenario: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(scenario) ? next.delete(scenario) : next.add(scenario);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          🧪 Pre-Rug Simulator
          <span className="text-xs font-normal text-sentinel-accent px-2 py-0.5 rounded-full border border-sentinel-accent/30">Beta</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          "What if?" analysis — simulate LP pull, mint exploits, whale dumps, and more before you buy.
        </p>
      </div>

      {/* Input */}
      <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Token mint address"
            value={mint}
            onChange={e => setMint(e.target.value.trim())}
            onKeyDown={e => e.key === 'Enter' && doSimulate()}
            className="flex-1 px-4 py-3 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sentinel-accent/50"
          />
          <button
            onClick={doSimulate}
            disabled={loading}
            className="px-6 py-3 bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? 'Simulating…' : '🧪 Simulate'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600">
          Simulates 6 rug scenarios using live on-chain data from RugCheck + Helius + Birdeye.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-sentinel-danger/30 bg-sentinel-danger/5 text-sm text-sentinel-danger">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Token header */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{result.tokenSymbol}</span>
                <span className={`text-sm font-mono ${
                  result.currentScore >= 70 ? 'text-sentinel-safe' :
                  result.currentScore >= 40 ? 'text-sentinel-caution' :
                  result.currentScore >= 10 ? 'text-sentinel-danger' :
                  'text-sentinel-rug'
                }`}>{result.currentScore}/100</span>
                <button
                  onClick={() => onViewToken(result.mint)}
                  className="text-[10px] text-sentinel-accent hover:underline"
                >
                  View risk →
                </button>
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-0.5">{result.mint}</p>
            </div>
          </div>

          {/* Overall risk */}
          <OverallRiskBar risk={result.overallRisk} />

          {/* Worst case callout */}
          {result.worstCase && (
            <div className="p-3 rounded-xl border border-sentinel-danger/40 bg-sentinel-danger/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">⚠️ Worst Case Scenario</p>
              <p className="text-sm text-white mt-1">
                <span className="font-bold">{SCENARIO_LABELS[result.worstCase.scenario] ?? result.worstCase.scenario}</span>
                {' — '}
                <span className="text-sentinel-danger font-bold">{result.worstCase.estimatedLossPct}% loss</span>
                {' in '}
                <span className="text-gray-300">{result.worstCase.estimatedTimeframe}</span>
              </p>
            </div>
          )}

          {/* All scenarios */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Scenario Analysis ({result.scenarios.filter(s => s.applicable).length}/{result.scenarios.length} applicable)
            </h3>
            {result.scenarios.map(s => (
              <ScenarioCard
                key={s.scenario}
                s={s}
                expanded={expanded.has(s.scenario)}
                onToggle={() => toggle(s.scenario)}
              />
            ))}
          </div>

          <p className="text-[9px] text-gray-700 text-center">
            Simulated at {new Date(result.simulatedAt).toLocaleString()} · Data from RugCheck + Helius + Birdeye
          </p>
        </div>
      )}
    </div>
  );
}
