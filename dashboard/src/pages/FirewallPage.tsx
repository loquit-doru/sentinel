import { useState, useEffect } from 'react';
import {
  screenToken,
  fetchFirewallConfig,
  fetchFirewallStats,
  fetchFirewallLog,
  addFirewallRule,
  removeFirewallRule,
  updateFirewallSettings,
} from '../api';
import type {
  FirewallScreenResult,
  FirewallWalletConfig,
  FirewallStats,
  FirewallLogEntry,
} from '../api';

const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function decisionBadge(d: string) {
  if (d === 'BLOCK') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">BLOCK</span>;
  if (d === 'WARN')  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">WARN</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">ALLOW</span>;
}

function tierColor(tier: string) {
  if (tier === 'safe') return 'text-sentinel-safe';
  if (tier === 'caution') return 'text-sentinel-caution';
  if (tier === 'danger') return 'text-sentinel-danger';
  return 'text-red-500';
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function FirewallPage({ connectedWallet }: { connectedWallet: string | null }) {
  const [tab, setTab] = useState<'screen' | 'rules' | 'log'>('screen');

  // Screen state
  const [mintInput, setMintInput] = useState('');
  const [amountInput, setAmountInput] = useState('100');
  const [screening, setScreening] = useState(false);
  const [screenResult, setScreenResult] = useState<FirewallScreenResult | null>(null);
  const [screenError, setScreenError] = useState('');

  // Config + rules
  const [config, setConfig] = useState<FirewallWalletConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<FirewallStats | null>(null);

  // Log
  const [log, setLog] = useState<FirewallLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // Rule add form
  const [ruleMint, setRuleMint] = useState('');
  const [ruleSymbol, setRuleSymbol] = useState('');
  const [ruleAction, setRuleAction] = useState<'block' | 'whitelist'>('block');
  const [ruleReason, setRuleReason] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  useEffect(() => {
    fetchFirewallStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (!connectedWallet) return;
    if (tab === 'rules') {
      setConfigLoading(true);
      fetchFirewallConfig(connectedWallet).then(setConfig).catch(() => {}).finally(() => setConfigLoading(false));
    }
    if (tab === 'log') {
      setLogLoading(true);
      fetchFirewallLog(connectedWallet).then(setLog).catch(() => {}).finally(() => setLogLoading(false));
    }
  }, [connectedWallet, tab]);

  const doScreen = async () => {
    const wallet = connectedWallet;
    if (!wallet) { setScreenError('Connect your wallet first'); return; }
    if (!SOLANA_RE.test(mintInput)) { setScreenError('Invalid token mint address'); return; }
    const amount = parseFloat(amountInput) || 100;

    setScreening(true);
    setScreenError('');
    setScreenResult(null);
    try {
      const result = await screenToken(wallet, mintInput, amount);
      setScreenResult(result);
    } catch (err) {
      setScreenError(err instanceof Error ? err.message : 'Screen failed');
    } finally {
      setScreening(false);
    }
  };

  const doAddRule = async () => {
    if (!connectedWallet || !SOLANA_RE.test(ruleMint)) return;
    setAddingRule(true);
    try {
      const updated = await addFirewallRule(connectedWallet, {
        tokenMint: ruleMint,
        tokenSymbol: ruleSymbol || undefined,
        action: ruleAction,
        reason: ruleReason || undefined,
      });
      setConfig(updated);
      setRuleMint('');
      setRuleSymbol('');
      setRuleReason('');
    } catch { /* silent */ }
    setAddingRule(false);
  };

  const doRemoveRule = async (ruleId: string) => {
    if (!connectedWallet) return;
    try {
      const updated = await removeFirewallRule(connectedWallet, ruleId);
      setConfig(updated);
    } catch { /* silent */ }
  };

  const doToggleSetting = async (key: 'autoBlockRug' | 'autoBlockDanger' | 'autoBlockLpDrain') => {
    if (!connectedWallet || !config) return;
    try {
      const updated = await updateFirewallSettings(connectedWallet, { [key]: !config[key] });
      setConfig(updated);
    } catch { /* silent */ }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          🛡️ Autonomous Firewall
          <span className="text-xs font-normal text-sentinel-accent px-2 py-0.5 rounded-full border border-sentinel-accent/30">v2</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Pre-signature transaction screening — automatically blocks rug tokens, LP drains & honeypots before you buy.
        </p>
      </div>

      {/* Global Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Screened" value={stats.totalScreened.toLocaleString()} />
          <StatCard label="Blocked" value={stats.totalBlocked.toLocaleString()} />
          <StatCard label="Warned" value={stats.totalWarned.toLocaleString()} />
          <StatCard label="Est. Saved" value={`$${stats.estimatedSavedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sentinel-border/30 pb-1">
        {([['screen', '🔍 Screen Token'], ['rules', '📋 Rules'], ['log', '📜 Activity Log']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              tab === id
                ? 'bg-sentinel-accent/15 text-sentinel-accent border-b-2 border-sentinel-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Screen Tab ─── */}
      {tab === 'screen' && (
        <div className="space-y-4">
          {!connectedWallet && (
            <div className="p-4 rounded-xl border border-sentinel-caution/30 bg-sentinel-caution/5 text-sm text-sentinel-caution">
              Connect your wallet to enable personalized firewall screening with custom rules.
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Token mint address..."
              value={mintInput}
              onChange={e => setMintInput(e.target.value.trim())}
              className="flex-1 px-4 py-3 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-xl text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-sentinel-accent/50"
            />
            <input
              type="number"
              placeholder="USD"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              className="w-24 px-3 py-3 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-xl text-white text-sm focus:outline-none focus:border-sentinel-accent/50"
            />
            <button
              onClick={doScreen}
              disabled={screening}
              className="px-5 py-3 bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold rounded-xl transition-all disabled:opacity-50 text-sm"
            >
              {screening ? 'Screening...' : 'Screen'}
            </button>
          </div>

          {screenError && (
            <div className="p-3 rounded-xl border border-sentinel-danger/30 bg-sentinel-danger/5 text-sm text-sentinel-danger">
              {screenError}
            </div>
          )}

          {screenResult && (
            <div className={`p-5 rounded-xl border space-y-4 ${
              screenResult.decision === 'BLOCK' ? 'border-red-500/40 bg-red-500/5' :
              screenResult.decision === 'WARN' ? 'border-yellow-500/40 bg-yellow-500/5' :
              'border-green-500/40 bg-green-500/5'
            }`}>
              {/* Decision header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {screenResult.decision === 'BLOCK' ? '🚫' : screenResult.decision === 'WARN' ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      {decisionBadge(screenResult.decision)}
                      <span className={`text-sm font-bold ${tierColor(screenResult.riskTier)}`}>
                        {screenResult.riskTier.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Score: {screenResult.riskScore}/100</p>
                  </div>
                </div>
                {screenResult.estimatedRiskUsd > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase">Risk Exposure</p>
                    <p className="text-lg font-bold text-sentinel-danger">${screenResult.estimatedRiskUsd.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Reasons */}
              <div className="space-y-1.5">
                {screenResult.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-600 mt-0.5">•</span>
                    <span className="text-gray-300">{r}</span>
                  </div>
                ))}
              </div>

              {/* Rules applied */}
              {screenResult.rulesApplied.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-gray-600 uppercase mb-1">Rules Applied</p>
                  <div className="flex flex-wrap gap-1.5">
                    {screenResult.rulesApplied.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 bg-sentinel-surface/50 border border-sentinel-border/30 rounded-full text-[10px] text-gray-400">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Rules Tab ─── */}
      {tab === 'rules' && (
        <div className="space-y-5">
          {!connectedWallet ? (
            <p className="text-sm text-gray-500">Connect your wallet to manage firewall rules.</p>
          ) : configLoading ? (
            <p className="text-sm text-gray-500 animate-pulse">Loading config...</p>
          ) : config ? (
            <>
              {/* Auto-protection settings */}
              <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
                <h3 className="text-sm font-semibold text-white">Auto-Protection</h3>
                {([
                  ['autoBlockRug', 'Auto-block Rug-tier tokens', 'Instantly blocks tokens scored 0-9 (confirmed rugs)'],
                  ['autoBlockDanger', 'Auto-block Danger-tier tokens', 'Blocks tokens scored 10-39 (high risk)'],
                  ['autoBlockLpDrain', 'Auto-block LP Drains', 'Blocks tokens with active liquidity drain alerts'],
                ] as const).map(([key, label, desc]) => (
                  <button
                    key={key}
                    onClick={() => doToggleSetting(key)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/3 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm text-white">{label}</p>
                      <p className="text-[10px] text-gray-600">{desc}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors flex items-center ${config[key] ? 'bg-sentinel-accent/40 justify-end' : 'bg-gray-700 justify-start'}`}>
                      <div className={`w-4 h-4 mx-0.5 rounded-full transition-colors ${config[key] ? 'bg-sentinel-accent' : 'bg-gray-500'}`} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Add rule form */}
              <div className="p-4 rounded-xl border border-sentinel-border/40 bg-sentinel-surface/20 space-y-3">
                <h3 className="text-sm font-semibold text-white">Add Rule</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Token mint" value={ruleMint} onChange={e => setRuleMint(e.target.value.trim())}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                  <input placeholder="Symbol (optional)" value={ruleSymbol} onChange={e => setRuleSymbol(e.target.value)}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                </div>
                <div className="flex gap-2">
                  <select value={ruleAction} onChange={e => setRuleAction(e.target.value as 'block' | 'whitelist')}
                    className="px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none">
                    <option value="block">Block</option>
                    <option value="whitelist">Whitelist</option>
                  </select>
                  <input placeholder="Reason (optional)" value={ruleReason} onChange={e => setRuleReason(e.target.value)}
                    className="flex-1 px-3 py-2 bg-sentinel-surface/40 border border-sentinel-border/50 rounded-lg text-white text-xs focus:outline-none focus:border-sentinel-accent/50" />
                  <button onClick={doAddRule} disabled={addingRule || !SOLANA_RE.test(ruleMint)}
                    className="px-4 py-2 bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold rounded-lg text-xs transition-all disabled:opacity-40">
                    {addingRule ? '...' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Existing rules */}
              {config.rules.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Your Rules ({config.rules.length})</h3>
                  {config.rules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          rule.action === 'block' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {rule.action === 'block' ? '🚫' : '✅'} {rule.action}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-white font-mono truncate">{rule.tokenSymbol || rule.tokenMint.slice(0, 12) + '...'}</p>
                          {rule.reason && <p className="text-[10px] text-gray-600">{rule.reason}</p>}
                        </div>
                      </div>
                      <button onClick={() => doRemoveRule(rule.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ─── Log Tab ─── */}
      {tab === 'log' && (
        <div className="space-y-3">
          {!connectedWallet ? (
            <p className="text-sm text-gray-500">Connect your wallet to see screening history.</p>
          ) : logLoading ? (
            <p className="text-sm text-gray-500 animate-pulse">Loading activity log...</p>
          ) : log.length === 0 ? (
            <p className="text-sm text-gray-500">No screening activity yet. Screen a token to get started.</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/20">
                <div className="flex items-center gap-3 min-w-0">
                  {decisionBadge(entry.decision)}
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white truncate">{entry.tokenSymbol || entry.tokenMint.slice(0, 12) + '...'}</p>
                    <p className="text-[10px] text-gray-600">{entry.reasons[0]}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold ${tierColor(entry.riskTier)}`}>{entry.riskScore}/100</p>
                  <p className="text-[10px] text-gray-600">${entry.amountUsd.toFixed(0)}</p>
                  <p className="text-[9px] text-gray-700">{new Date(entry.screenedAt).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bookmarklet fallback */}
      <div className="p-4 rounded-xl border border-sentinel-border/20 bg-sentinel-surface/10 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Check (Bookmarklet)</h3>
        <p className="text-[10px] text-gray-600">
          Drag to bookmarks bar for instant risk checks on bags.fm:
        </p>
        <a
          href={`javascript:void(function(){var u=location.href,m=u.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);if(!m){alert('No Solana address found');return}window.open('https://sentinel-dashboard-3uy.pages.dev?risk='+m[0],'_blank')}())`}
          onClick={e => e.preventDefault()}
          draggable
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sentinel-surface/50 border border-sentinel-border/50 text-white text-xs font-semibold cursor-grab active:cursor-grabbing select-none"
        >
          🛡️ Sentinel Firewall
        </a>
      </div>
    </div>
  );
}
