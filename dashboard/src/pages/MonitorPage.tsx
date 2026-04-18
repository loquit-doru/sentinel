import { useState, useEffect } from 'react';
import { connectMonitorAuto, unregisterMonitor } from '../api';

const BOT_HANDLE = 'SentinelBagsBot'; // update if bot handle is different

export function MonitorPage({ connectedWallet }: { connectedWallet: string | null }) {
  const [wallet, setWallet] = useState(connectedWallet ?? '');
  const [username, setUsername] = useState('');
  const [threshold, setThreshold] = useState('1');
  const [step, setStep] = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (connectedWallet && !wallet) setWallet(connectedWallet);
  }, [connectedWallet]);

  const handleConnect = async () => {
    if (!wallet || wallet.length < 32) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    setStep('connecting');
    setError(null);

    try {
      await connectMonitorAuto(
        wallet,
        parseFloat(threshold) || 1,
        username.replace('@', '') || undefined,
      );
      setStep('done');
      setRegistered(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      setStep('error');
    }
  };

  const handleRemove = async () => {
    if (!wallet) return;
    await unregisterMonitor(wallet);
    setRegistered(false);
    setStep('idle');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          Wallet Monitor
          <span className="text-xs font-normal text-gray-500 px-2 py-0.5 rounded-full border border-sentinel-border/50">Telegram</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Register your wallet and get automatic Telegram alerts — accumulated fees, risky tokens, LP drains.
        </p>
      </div>

      {/* Step 1: Start bot */}
      <div className="p-4 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-sentinel-accent/20 text-sentinel-accent text-xs flex items-center justify-center font-bold">1</span>
          <h3 className="text-sm font-medium text-white">Start the Telegram bot</h3>
        </div>
        <p className="text-xs text-gray-400 pl-7">
          Open Telegram, search for <span className="text-sentinel-accent font-mono">@{BOT_HANDLE}</span> and press <strong>Start</strong>. Send any message.
        </p>
        <a
          href={`https://t.me/${BOT_HANDLE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-7 inline-flex items-center gap-1.5 text-xs bg-sentinel-accent hover:bg-sentinel-accent-dim text-white px-3 py-1.5 rounded-lg transition-all"
        >
          Open @{BOT_HANDLE} ↗
        </a>
      </div>

      {/* Step 2: Configure */}
      <div className="p-4 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-sentinel-accent/20 text-sentinel-accent text-xs flex items-center justify-center font-bold">2</span>
          <h3 className="text-sm font-medium text-white">Configure alerts</h3>
        </div>

        <div className="space-y-3 pl-7">
          {/* Wallet */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Solana Wallet</label>
            <input
              type="text"
              value={wallet}
              onChange={e => setWallet(e.target.value.trim())}
              placeholder="Wallet address…"
              spellCheck={false}
              className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sentinel-accent/50 font-mono"
            />
            {connectedWallet && wallet !== connectedWallet && (
              <button onClick={() => setWallet(connectedWallet)} className="text-[11px] text-sentinel-accent hover:underline">
                Use connected wallet →
              </button>
            )}
          </div>

          {/* Telegram username */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Telegram Username <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.trim())}
              placeholder="@username"
              className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sentinel-accent/50"
            />
            <p className="text-[10px] text-gray-600">Leave empty if you've already messaged the bot — we'll auto-detect your chat.</p>
          </div>

          {/* Threshold */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Fee alert threshold (USD)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                className="w-28 bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sentinel-accent/50"
              />
              <span className="text-xs text-gray-500">Minimum USD to trigger a fee alert</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {step === 'done' && (
        <div className="p-4 bg-sentinel-safe/5 border border-sentinel-safe/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sentinel-safe text-lg">✅</span>
            <p className="text-sm font-medium text-white">Connected successfully!</p>
          </div>
          <p className="text-xs text-gray-400">
            Sentinel monitors your wallet every 15 minutes. You'll receive a Telegram message when fees accumulate or risks appear in your portfolio.
          </p>
          <button
            onClick={handleRemove}
            className="text-xs text-sentinel-danger hover:underline mt-1"
          >
            Stop monitoring →
          </button>
        </div>
      )}

      {/* Connect button */}
      {step !== 'done' && (
        <button
          onClick={handleConnect}
          disabled={step === 'connecting' || !wallet}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
            step === 'connecting'
              ? 'bg-sentinel-accent/20 text-sentinel-accent/60 cursor-wait'
              : 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {step === 'connecting' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-sentinel-accent border-t-transparent rounded-full animate-spin" />
              Connecting…
            </span>
          ) : 'Enable Telegram Alerts'}
        </button>
      )}

      {/* How it works */}
      <div className="p-4 rounded-xl border border-sentinel-border/30 bg-sentinel-surface/10 space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What we monitor</h3>
        <div className="space-y-2">
          {[
            { icon: '💰', label: 'Accumulated fees', desc: `Alert when unclaimed fees exceed $${threshold}` },
            { icon: '🚨', label: 'LP Drain', desc: 'Sudden liquidity drop in held tokens' },
            { icon: '⚠️', label: 'Tier change', desc: 'Token moves from SAFE → CAUTION or DANGER' },
            { icon: '🛡️', label: 'Rising risk', desc: 'Risk score deteriorating rapidly' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 text-xs">
              <span className="text-base shrink-0">{item.icon}</span>
              <div>
                <span className="text-gray-300 font-medium">{item.label}</span>
                <span className="text-gray-600"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-700 pt-1">Scanare automată la fiecare 15 minute · Alertele se trimit pe Telegram în timp real</p>
      </div>
    </div>
  );
}
