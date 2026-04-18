import { useState, useEffect } from 'react';
import {
  fetchPartnerConfig, fetchPartnerStats, registerPartner,
  fetchTokenGate, fetchAppInfo, fetchSentFeeShare,
  type PartnerConfigData, type PartnerClaimStatsData, type TokenGateData,
  type AppStoreInfoData, type SentFeeShareData,
} from '../api';

interface Props {
  connectedWallet: string | null;
}

const TIER_COLORS: Record<string, string> = {
  free: '#6b7280',
  holder: '#06b6d4',
  whale: '#f59e0b',
};
const TIER_EMOJI: Record<string, string> = {
  free: '🔓',
  holder: '🛡️',
  whale: '🐋',
};

export default function BagsNativePage({ connectedWallet }: Props) {
  const [partnerConfig, setPartnerConfig] = useState<PartnerConfigData | null>(null);
  const [partnerStats, setPartnerStats] = useState<PartnerClaimStatsData | null>(null);
  const [gateResult, setGateResult] = useState<TokenGateData | null>(null);
  const [appInfo, setAppInfo] = useState<AppStoreInfoData | null>(null);
  const [feeShare, setFeeShare] = useState<SentFeeShareData | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [registerTx, setRegisterTx] = useState<string | null>(null);

  const load = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading('');
    }
  };

  const loadAll = (wallet: string) => load('Loading Bags integration...', async () => {
    const [pc, gate, app, fs] = await Promise.all([
      fetchPartnerConfig(wallet).catch(() => null),
      fetchTokenGate(wallet).catch(() => null),
      fetchAppInfo().catch(() => null),
      fetchSentFeeShare().catch(() => null),
    ]);
    setPartnerConfig(pc);
    setGateResult(gate);
    setAppInfo(app);
    setFeeShare(fs);

    if (pc?.registered) {
      const stats = await fetchPartnerStats(wallet).catch(() => null);
      setPartnerStats(stats);
    }
  });

  const handleRegisterPartner = () => {
    if (!connectedWallet) return;
    setRegisterTx(null);
    load('Registering partner...', async () => {
      const tx = await registerPartner(connectedWallet);
      setRegisterTx(tx.transaction);
      setPartnerConfig(await fetchPartnerConfig(connectedWallet));
    });
  };

  // Auto-load when wallet connects
  useEffect(() => {
    if (connectedWallet && !partnerConfig && !gateResult) {
      loadAll(connectedWallet);
    }
    // Load app-only data even without wallet
    if (!connectedWallet && !appInfo) {
      load('Loading app info...', async () => {
        const [app, fs] = await Promise.all([
          fetchAppInfo().catch(() => null),
          fetchSentFeeShare().catch(() => null),
        ]);
        setAppInfo(app);
        setFeeShare(fs);
      });
    }
  }, [connectedWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          🎒 Bags Native Integration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Partner config, $SENT token gating, fee-share setup, and app store presence.
        </p>
      </div>

      {!connectedWallet && !appInfo && (
        <div className="p-4 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 text-center space-y-1">
          <p className="text-sm text-gray-400">Connect your wallet to view $SENT tier, partner status, and claim fees.</p>
          <p className="text-xs text-gray-600">App store info and fee-share config are available without a wallet.</p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-sentinel-danger/30 bg-sentinel-danger/5 text-sm text-sentinel-danger">{error}</div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-4 h-4 border-2 border-sentinel-accent/30 border-t-sentinel-accent rounded-full animate-spin" />
          {loading}
        </div>
      )}

      {/* Token Gate */}
      {gateResult && (
        <div className="p-5 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            {TIER_EMOJI[gateResult.tier]} $SENT Token Gate
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              gateResult.tier === 'whale' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              gateResult.tier === 'holder' ? 'bg-sentinel-accent/20 text-sentinel-accent border border-sentinel-accent/30' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}>
              {gateResult.tier.toUpperCase()}
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="$SENT Balance" value={gateResult.sentBalance.toLocaleString()} />
            <StatCard label="Tier" value={gateResult.tier} />
            <StatCard label="Premium Access" value={gateResult.eligible ? '✅ Yes' : '❌ No'} />
          </div>
          {!gateResult.eligible && (
            <p className="text-xs text-gray-500">
              Hold ≥1 $SENT to unlock premium features (priority alerts, deeper scans, auto-claim).
              Hold ≥10,000 $SENT for whale tier (API key, bulk scanning).
            </p>
          )}
        </div>
      )}

      {/* Partner Config */}
      {partnerConfig && (
        <div className="p-5 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-4">
          <h3 className="text-base font-bold">🤝 Partner Registration</h3>
          {partnerConfig.registered && partnerConfig.config ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Partner BPS" value={`${partnerConfig.config.bps} bps`} />
                <StatCard label="Status" value="✅ Registered" />
              </div>
              {partnerStats && (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Claimed Fees" value={`$${partnerStats.claimedFeesUsd.toFixed(2)}`} />
                  <StatCard label="Unclaimed Fees" value={`$${partnerStats.unclaimedFeesUsd.toFixed(2)}`} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Register as a Bags partner to receive a share of fees from tokens that integrate with Sentinel.
              </p>
              <button
                onClick={handleRegisterPartner}
                disabled={!!loading}
                className="px-5 py-2.5 bg-sentinel-safe hover:bg-sentinel-safe/80 text-sentinel-bg font-bold text-sm rounded-lg transition-all disabled:opacity-50"
              >
                {loading === 'Registering partner...' ? 'Registering…' : 'Register as Partner'}
              </button>
            </div>
          )}
          {/* Show raw tx for user to sign */}
          {registerTx && (
            <div className="p-3 rounded-lg border border-sentinel-accent/30 bg-sentinel-accent/5 space-y-1">
              <p className="text-xs font-semibold text-sentinel-accent">Partner registration transaction created</p>
              <p className="text-[10px] text-gray-400">Sign this transaction with your wallet to complete registration:</p>
              <p className="text-[10px] font-mono text-gray-300 break-all">{registerTx}</p>
            </div>
          )}
        </div>
      )}

      {/* Fee Share Config */}
      {feeShare && (
        <div className="p-5 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-4">
          <h3 className="text-base font-bold">💰 $SENT Fee Share Config</h3>
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Creator" value={`${feeShare.allocations.creatorPct}%`} />
            <StatCard label="Holders" value={`${feeShare.allocations.holdersPct}%`} />
            <StatCard label="Dev Fund" value={`${feeShare.allocations.devFundPct}%`} />
            <StatCard label="Partner" value={`${feeShare.allocations.partnerPct}%`} />
          </div>
          {/* Distribution bar */}
          <div className="h-5 rounded-lg overflow-hidden flex">
            <div style={{ width: `${feeShare.allocations.creatorPct}%` }} className="bg-sentinel-accent" title="Creator" />
            <div style={{ width: `${feeShare.allocations.holdersPct}%` }} className="bg-sentinel-safe" title="Holders" />
            <div style={{ width: `${feeShare.allocations.devFundPct}%` }} className="bg-yellow-500" title="Dev" />
            <div style={{ width: `${feeShare.allocations.partnerPct}%` }} className="bg-purple-500" title="Partner" />
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span><span className="text-sentinel-accent">■</span> Creator</span>
            <span><span className="text-sentinel-safe">■</span> Holders</span>
            <span><span className="text-yellow-500">■</span> Dev Fund</span>
            <span><span className="text-purple-500">■</span> Partner</span>
          </div>
        </div>
      )}

      {/* App Store Info */}
      {appInfo && (
        <div className="p-5 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/20 space-y-4">
          <h3 className="text-base font-bold">🏪 App Store Profile</h3>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-semibold text-white">{appInfo.name}</span>
            <span className="text-gray-500">Tagline</span>
            <span className="text-gray-300">{appInfo.tagline}</span>
            <span className="text-gray-500">Category</span>
            <span className="text-gray-300">{appInfo.category}</span>
            <span className="text-gray-500">Token</span>
            <span>
              <a href={appInfo.token.bagsUrl} target="_blank" rel="noreferrer" className="text-sentinel-accent hover:underline">
                ${appInfo.token.symbol}
              </a>
            </span>
            <span className="text-gray-500">Version</span>
            <span className="text-gray-300">{appInfo.version}</span>
            <span className="text-gray-500">Features</span>
            <span className="text-gray-300">{appInfo.features.length} capabilities</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(appInfo.links).map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 text-xs rounded-lg border border-sentinel-border/50 text-gray-300 hover:text-white hover:border-sentinel-accent/40 transition-colors"
              >
                {key}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border border-sentinel-border/40 bg-sentinel-bg/60 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}
