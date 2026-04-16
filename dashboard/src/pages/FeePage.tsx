import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { SmartFeeSnapshot, SmartFeePosition, FeeUrgency } from '../../../shared/types';
import { fetchSmartFees, fetchClaimTransactions, connectMonitorAuto } from '../api';

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

function formatSol(n: number): string {
  if (n >= 1) return `${n.toFixed(4)} SOL`;
  if (n > 0) return `${(n * 1e6).toFixed(0)} μSOL`;
  return '0 SOL';
}

/** Deserialize a base58-encoded tx; auto-detect legacy vs versioned. */
function deserializeTx(base58Str: string): Transaction | VersionedTransaction {
  const bytes = bs58.decode(base58Str);
  // Versioned transactions have a prefix byte >= 0x80
  if (bytes[0] >= 0x80) {
    return VersionedTransaction.deserialize(bytes);
  }
  return Transaction.from(bytes);
}

function shortenSig(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

type ClaimState = 'idle' | 'building' | 'signing' | 'sending' | 'success' | 'error';

const URGENCY_CONFIG: Record<FeeUrgency, { bg: string; border: string; text: string; icon: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '🚨', label: 'CRITICAL' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '⚠️', label: 'WARNING' },
  safe: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: '✅', label: 'SAFE' },
  unknown: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', icon: '❓', label: 'UNKNOWN' },
};

function SmartPositionRow({
  pos,
  onClaim,
  claimState,
  claimError,
  txSignature,
}: {
  pos: SmartFeePosition;
  onClaim: (mint: string) => void;
  claimState: ClaimState;
  claimError: string | null;
  txSignature: string | null;
}) {
  const uc = URGENCY_CONFIG[pos.urgency];
  const isBusy = claimState === 'building' || claimState === 'signing' || claimState === 'sending';

  const stateLabel: Record<ClaimState, string> = {
    idle: 'Claim',
    building: 'Building…',
    signing: 'Sign…',
    sending: 'Sending…',
    success: '✓ Done',
    error: 'Retry',
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${uc.border} ${uc.bg} transition-all`}>
      <span className="text-lg">{uc.icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-medium text-sm">{pos.tokenName}</span>
          <span className="text-gray-500 text-xs">{pos.tokenSymbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${uc.border} ${uc.text} font-semibold`}>
            {uc.label}
          </span>
          {pos.riskScore !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              pos.riskTier === 'safe' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
              pos.riskTier === 'caution' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
              pos.riskTier === 'danger' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-red-900/20 text-red-300 border border-red-900/30'
            }`}>
              Risk: {pos.riskScore}/100
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 truncate">{pos.urgencyReason}</p>
        {claimState === 'error' && claimError && (
          <p className="text-xs text-red-400 mt-1">{claimError}</p>
        )}
        {claimState === 'success' && txSignature && (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sentinel-accent hover:underline mt-1 inline-block"
          >
            Tx: {shortenSig(txSignature)} ↗
          </a>
        )}
      </div>

      <div className="text-right shrink-0 flex items-center gap-3">
        <div>
          <p className="text-sentinel-safe font-semibold text-sm">{formatUsd(pos.claimableUsd)}</p>
          <p className="text-gray-500 text-xs">{formatSol(pos.claimableAmount)}</p>
        </div>
        <button
          onClick={() => onClaim(pos.tokenMint)}
          disabled={isBusy || claimState === 'success'}
          className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            claimState === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
              : claimState === 'error'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : isBusy
                  ? 'bg-sentinel-accent/20 text-sentinel-accent/60 border border-sentinel-accent/20 cursor-wait'
                  : 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white'
          }`}
        >
          {stateLabel[claimState]}
        </button>
      </div>
    </div>
  );
}

const AUTO_CLAIM_INTERVAL = 60_000;

export function FeePage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [snapshot, setSnapshot] = useState<SmartFeeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimStates, setClaimStates] = useState<Record<string, ClaimState>>({});
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [claimSigs, setClaimSigs] = useState<Record<string, string>>({});
  const [claimAllBusy, setClaimAllBusy] = useState(false);

  // Auto-claim state
  const [autoClaim, setAutoClaim] = useState(false);
  const [autoClaimThreshold, setAutoClaimThreshold] = useState(1.0);
  const autoClaimRef = useRef(false);

  // Telegram monitoring
  const [monitorRegistered, setMonitorRegistered] = useState(false);
  const [monitorBusy, setMonitorBusy] = useState(false);
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? '';

  const loadFees = useCallback(async (w: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSmartFees(w);
      setSnapshot(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      loadFees(walletAddress);
    } else {
      setSnapshot(null);
    }
  }, [walletAddress, loadFees]);

  const handleClaim = useCallback(async (tokenMint: string) => {
    if (!walletAddress || !signTransaction) return;

    setClaimStates((s) => ({ ...s, [tokenMint]: 'building' }));
    setClaimErrors((s) => ({ ...s, [tokenMint]: '' }));
    setClaimSigs((s) => ({ ...s, [tokenMint]: '' }));

    try {
      const { transactions } = await fetchClaimTransactions(walletAddress, tokenMint);
      if (!transactions.length) throw new Error('No claim transactions returned');

      let lastSig = '';

      for (const txData of transactions) {
        setClaimStates((s) => ({ ...s, [tokenMint]: 'signing' }));
        const tx = deserializeTx(txData.tx);
        const signed = await signTransaction(tx);

        setClaimStates((s) => ({ ...s, [tokenMint]: 'sending' }));
        const rawTx = signed.serialize();
        const sig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        await connection.confirmTransaction(
          { signature: sig, blockhash: txData.blockhash, lastValidBlockHeight: txData.lastValidBlockHeight },
          'confirmed',
        );
        lastSig = sig;
      }

      setClaimStates((s) => ({ ...s, [tokenMint]: 'success' }));
      setClaimSigs((s) => ({ ...s, [tokenMint]: lastSig }));

      setTimeout(() => {
        if (walletAddress) loadFees(walletAddress);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      setClaimStates((s) => ({ ...s, [tokenMint]: 'error' }));
      setClaimErrors((s) => ({ ...s, [tokenMint]: msg }));
    }
  }, [walletAddress, signTransaction, connection, loadFees]);

  // Claim all urgent positions
  const handleClaimAll = useCallback(async () => {
    if (!snapshot || !walletAddress) return;
    const urgent = snapshot.positions.filter(
      (p) => (p.urgency === 'critical' || p.urgency === 'warning') &&
             p.claimableUsd > 0 &&
             (claimStates[p.tokenMint] ?? 'idle') !== 'success',
    );
    if (!urgent.length) return;

    setClaimAllBusy(true);
    for (const pos of urgent) {
      await handleClaim(pos.tokenMint);
    }
    setClaimAllBusy(false);
  }, [snapshot, walletAddress, claimStates, handleClaim]);

  // Auto-claim loop
  useEffect(() => {
    autoClaimRef.current = autoClaim;
  }, [autoClaim]);

  useEffect(() => {
    if (!autoClaim || !walletAddress || !signTransaction) return;

    const interval = setInterval(async () => {
      if (!autoClaimRef.current) return;
      if (document.visibilityState !== 'visible') return;

      const data = await loadFees(walletAddress);
      if (!data || data.totalClaimableUsd < autoClaimThreshold) return;

      const toClaim = data.positions.filter(
        (p) => (p.urgency === 'critical' || p.urgency === 'warning') &&
               p.claimableUsd > 0 &&
               (claimStates[p.tokenMint] ?? 'idle') !== 'success',
      );

      for (const pos of toClaim) {
        if (!autoClaimRef.current) break;
        await handleClaim(pos.tokenMint);
      }
    }, AUTO_CLAIM_INTERVAL);

    return () => clearInterval(interval);
  }, [autoClaim, walletAddress, signTransaction, autoClaimThreshold, loadFees, handleClaim, claimStates]);

  // Register Telegram monitoring
  const handleRegisterMonitor = useCallback(async () => {
    if (!walletAddress) return;

    setMonitorBusy(true);
    setMonitorError(null);
    setMonitorMessage(null);
    try {
      const monitor = await connectMonitorAuto(walletAddress, autoClaimThreshold);
      setMonitorRegistered(true);

      if (monitor.persisted === false) {
        setMonitorMessage('Telegram connected and test sent. Temporary mode: settings are not persisted until KV quota resets.');
      } else {
        setMonitorMessage('Telegram connected automatically. Test message sent successfully.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable Telegram alerts';
      setMonitorError(msg);
      setMonitorRegistered(false);
      console.error('Monitor register failed:', err);
    } finally {
      setMonitorBusy(false);
    }
  }, [walletAddress, autoClaimThreshold]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Smart Fee Claim</h2>
        <p className="text-gray-400 text-sm">Risk-aware fee intelligence — claim urgent positions first</p>
      </div>

      {/* Wallet connect */}
      <div className="flex justify-center">
        <WalletMultiButton className="!bg-sentinel-accent hover:!bg-sentinel-accent-dim !rounded-lg !text-sm !font-medium !h-10 !px-5" />
      </div>

      {/* Auto-Claim Controls */}
      {connected && (
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Auto-Claim Mode</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Scans every 60s, auto-claims urgent positions when threshold is met
              </p>
            </div>
            <button
              onClick={() => setAutoClaim(!autoClaim)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoClaim ? 'bg-sentinel-accent' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                autoClaim ? 'left-[26px]' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Threshold */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 whitespace-nowrap">Min threshold:</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={autoClaimThreshold}
                onChange={(e) => setAutoClaimThreshold(Math.max(0, Number(e.target.value)))}
                className="bg-sentinel-bg border border-sentinel-border rounded px-2 py-1 text-sm text-white w-20 focus:outline-none focus:border-sentinel-accent"
              />
            </div>
          </div>

          {autoClaim && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400">Auto-claim active — monitoring every 60s</span>
            </div>
          )}

          {/* Telegram Registration */}
          <div className="pt-3 border-t border-sentinel-border/50 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telegram Alerts (optional)</h4>
            <p className="text-xs text-gray-500">Get notified when fees accrue, even when the dashboard is closed.</p>
            <button
              onClick={handleRegisterMonitor}
              disabled={monitorBusy || monitorRegistered}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
                monitorRegistered
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white'
              }`}
            >
              {monitorRegistered ? '✓ Active' : monitorBusy ? 'Connecting…' : 'Connect Telegram'}
            </button>
            {monitorRegistered && (
              <p className="text-[10px] text-green-400/80">✓ Sentinel will notify you via Telegram when fees are ready</p>
            )}
            {monitorMessage && (
              <p className="text-[10px] text-green-400/80">{monitorMessage}</p>
            )}
            {monitorError && (
              <p className="text-[10px] text-red-400/90">{monitorError}</p>
            )}
            <p className="text-[10px] text-gray-500/90">
              Step 1: Open your bot chat and press Start. Step 2: Send any message. Step 3: Click Connect Telegram.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !snapshot && (
        <div className="flex flex-col items-center py-16 space-y-4 animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-sentinel-accent/10 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-sentinel-accent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm">Analyzing fees + risk scores…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 text-center space-y-2 animate-fade-in">
          <p className="text-red-400 font-semibold">Failed to load fees</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => walletAddress && loadFees(walletAddress)}
            className="text-sm text-sentinel-accent hover:underline mt-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {snapshot && !error && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Claimable</p>
                <p className="text-3xl font-bold text-sentinel-safe mt-1">
                  {formatUsd(snapshot.totalClaimableUsd)}
                </p>
                {snapshot.urgentClaimableUsd > 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    🚨 {formatUsd(snapshot.urgentClaimableUsd)} needs urgent claiming
                  </p>
                )}
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Positions</p>
                    <p className="text-lg font-semibold text-white">{snapshot.positions.length}</p>
                  </div>
                  {snapshot.criticalCount > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Critical</p>
                      <p className="text-lg font-semibold text-red-400">{snapshot.criticalCount}</p>
                    </div>
                  )}
                </div>
                {snapshot.urgentClaimableUsd > 0 && (
                  <button
                    onClick={handleClaimAll}
                    disabled={claimAllBusy || !signTransaction}
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:cursor-not-allowed text-white transition-all"
                  >
                    {claimAllBusy ? 'Claiming…' : `⚡ Claim Urgent (${formatUsd(snapshot.urgentClaimableUsd)})`}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sentinel-border/50">
              <code className="text-[11px] text-gray-500 truncate flex-1">{snapshot.wallet}</code>
              <span className="text-[10px] text-gray-600">
                Updated {new Date(snapshot.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Pitch metrics */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Gross Claimable</p>
              <p className="text-xl font-bold text-white mt-1">{formatUsd(snapshot.totalClaimableUsd)}</p>
              <p className="text-[11px] text-gray-500 mt-1">From {snapshot.positions.length} positions</p>
            </div>
            <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Sentinel Fee (0.5%)</p>
              <p className="text-xl font-bold text-sentinel-accent mt-1">{formatUsd(snapshot.totalClaimableUsd * 0.005)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Pitch metric: platform revenue preview</p>
            </div>
            <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Net To Creator</p>
              <p className="text-xl font-bold text-sentinel-safe mt-1">{formatUsd(snapshot.totalClaimableUsd * 0.995)}</p>
              <p className="text-[11px] text-gray-500 mt-1">After 0.5% Sentinel partner fee</p>
            </div>
          </div>

          {/* Positions */}
          {snapshot.positions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Positions (sorted by urgency)
              </h3>
              {snapshot.positions.map((pos) => (
                <SmartPositionRow
                  key={pos.tokenMint}
                  pos={pos}
                  onClaim={handleClaim}
                  claimState={claimStates[pos.tokenMint] ?? 'idle'}
                  claimError={claimErrors[pos.tokenMint] ?? null}
                  txSignature={claimSigs[pos.tokenMint] ?? null}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm">No claimable fees found.</p>
              <p className="text-xs text-gray-600 mt-1">
                Enable Auto-Claim to get notified when fees are ready.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!connected && !loading && (
        <div className="text-center py-12 text-gray-600 space-y-3 animate-fade-in">
          <p className="text-4xl">💰</p>
          <p className="text-sm">Connect your wallet to discover unclaimed Bags creator fees</p>
          <div className="flex flex-wrap justify-center gap-2 text-[10px] text-gray-600">
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Risk-Aware Urgency</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Auto-Claim Mode</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Telegram Alerts</span>
          </div>
        </div>
      )}
    </div>
  );
}
