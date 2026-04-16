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
    load('Registering partner...', async () => {
      const tx = await registerPartner(connectedWallet);
      alert(`Partner registration tx created!\n\nSign with your wallet:\n${tx.transaction.slice(0, 40)}...`);
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#06b6d4' }}>
        🎒 Bags Native Integration
      </h2>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
        Partner config, $SENT token gating, fee-share setup, and app store presence.
      </p>

      {!connectedWallet && !appInfo && (
        <div style={{
          background: '#1e293b', borderRadius: 10, padding: 20, border: '1px solid #334155',
          textAlign: 'center', marginBottom: 16,
        }}>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
            Connect your wallet to view $SENT tier, partner status, and claim fees.
          </p>
          <p style={{ color: '#64748b', fontSize: 12 }}>
            App store info and fee-share config are available without a wallet.
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: '#7f1d1d', padding: '12px 16px', borderRadius: 8, color: '#fca5a5', margin: '16px 0', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Token Gate */}
      {gateResult && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {TIER_EMOJI[gateResult.tier]} $SENT Token Gate
            <span style={{
              background: TIER_COLORS[gateResult.tier], color: '#0f172a',
              padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, marginLeft: 8,
            }}>
              {gateResult.tier.toUpperCase()}
            </span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <StatCard label="$SENT Balance" value={gateResult.sentBalance.toLocaleString()} />
            <StatCard label="Tier" value={gateResult.tier} />
            <StatCard label="Premium Access" value={gateResult.eligible ? '✅ Yes' : '❌ No'} />
          </div>
          {!gateResult.eligible && (
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>
              Hold ≥1 $SENT to unlock premium features (priority alerts, deeper scans, auto-claim).
              Hold ≥10,000 $SENT for whale tier (API key, bulk scanning).
            </p>
          )}
        </div>
      )}

      {/* Partner Config */}
      {partnerConfig && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            🤝 Partner Registration
          </h3>
          {partnerConfig.registered && partnerConfig.config ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatCard label="Partner BPS" value={`${partnerConfig.config.bps} bps`} />
                <StatCard label="Status" value="✅ Registered" />
              </div>
              {partnerStats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <StatCard label="Claimed Fees" value={`$${partnerStats.claimedFeesUsd.toFixed(2)}`} />
                  <StatCard label="Unclaimed Fees" value={`$${partnerStats.unclaimedFeesUsd.toFixed(2)}`} />
                </div>
              )}
            </>
          ) : (
            <div>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                Register as a Bags partner to receive a share of fees from tokens that integrate with Sentinel.
              </p>
              <button
                onClick={handleRegisterPartner}
                disabled={!!loading}
                style={{
                  background: '#22c55e', color: '#0f172a', border: 'none',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14,
                  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading === 'Registering partner...' ? loading : 'Register as Partner'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fee Share Config */}
      {feeShare && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            💰 $SENT Fee Share Config
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <StatCard label="Creator" value={`${feeShare.allocations.creatorPct}%`} />
            <StatCard label="Holders" value={`${feeShare.allocations.holdersPct}%`} />
            <StatCard label="Dev Fund" value={`${feeShare.allocations.devFundPct}%`} />
            <StatCard label="Partner" value={`${feeShare.allocations.partnerPct}%`} />
          </div>
          <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${feeShare.allocations.creatorPct}%`, background: '#06b6d4' }} title="Creator" />
            <div style={{ width: `${feeShare.allocations.holdersPct}%`, background: '#22c55e' }} title="Holders" />
            <div style={{ width: `${feeShare.allocations.devFundPct}%`, background: '#f59e0b' }} title="Dev" />
            <div style={{ width: `${feeShare.allocations.partnerPct}%`, background: '#8b5cf6' }} title="Partner" />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
            <span><span style={{ color: '#06b6d4' }}>■</span> Creator</span>
            <span><span style={{ color: '#22c55e' }}>■</span> Holders</span>
            <span><span style={{ color: '#f59e0b' }}>■</span> Dev Fund</span>
            <span><span style={{ color: '#8b5cf6' }}>■</span> Partner</span>
          </div>
        </div>
      )}

      {/* App Store Info */}
      {appInfo && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            🏪 App Store Profile
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px 16px', fontSize: 13 }}>
            <span style={{ color: '#94a3b8' }}>Name</span>
            <span style={{ fontWeight: 600 }}>{appInfo.name}</span>
            <span style={{ color: '#94a3b8' }}>Tagline</span>
            <span>{appInfo.tagline}</span>
            <span style={{ color: '#94a3b8' }}>Category</span>
            <span>{appInfo.category}</span>
            <span style={{ color: '#94a3b8' }}>Token</span>
            <span>
              <a href={appInfo.token.bagsUrl} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>
                ${appInfo.token.symbol}
              </a>
            </span>
            <span style={{ color: '#94a3b8' }}>Version</span>
            <span>{appInfo.version}</span>
            <span style={{ color: '#94a3b8' }}>Features</span>
            <span>{appInfo.features.length} capabilities</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(appInfo.links).map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#334155', color: '#e2e8f0', padding: '4px 12px',
                  borderRadius: 6, fontSize: 12, textDecoration: 'none',
                }}
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
    <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
    </div>
  );
}
