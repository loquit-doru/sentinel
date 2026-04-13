import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { FeeSnapshot, ClaimablePosition } from '../../../shared/types';
import { fetchFeeSnapshot, fetchClaimTransactions } from '../api';

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

type ClaimState = 'idle' | 'building' | 'signing' | 'sending' | 'success' | 'error';

function PositionRow({
  pos,
  rank,
  onClaim,
  claimState,
  claimError,
}: {
  pos: ClaimablePosition;
  rank: number;
  onClaim: (mint: string) => void;
  claimState: ClaimState;
  claimError: string | null;
}) {
  const versionBadge = pos.source === 'fee-share-v2'
    ? 'bg-sentinel-accent/10 text-sentinel-accent border-sentinel-accent/30'
    : 'bg-gray-800 text-gray-400 border-gray-700';

  const isBusy = claimState === 'building' || claimState === 'signing' || claimState === 'sending';

  const stateLabel: Record<ClaimState, string> = {
    idle: 'Claim',
    building: 'Building tx…',
    signing: 'Sign in wallet…',
    sending: 'Sending…',
    success: '✓ Claimed',
    error: 'Retry',
  };

  return (
    <div className="group flex items-center gap-4 p-4 rounded-lg border border-sentinel-border/50 hover:border-sentinel-border bg-sentinel-surface/40 hover:bg-sentinel-surface transition-all">
      <span className="text-xs text-gray-600 w-6 text-right font-mono">{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm truncate">{pos.tokenName}</span>
          <span className="text-gray-500 text-xs">{pos.tokenSymbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${versionBadge}`}>
            {pos.source === 'fee-share-v2' ? 'v2' : 'v1'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{pos.tokenMint}</p>
        {claimState === 'error' && claimError && (
          <p className="text-xs text-sentinel-danger mt-1">{claimError}</p>
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
              ? 'bg-sentinel-safe/20 text-sentinel-safe border border-sentinel-safe/30 cursor-default'
              : claimState === 'error'
                ? 'bg-sentinel-danger/10 text-sentinel-danger border border-sentinel-danger/30 hover:bg-sentinel-danger/20'
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

export function FeePage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [snapshot, setSnapshot] = useState<FeeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimStates, setClaimStates] = useState<Record<string, ClaimState>>({});
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});

  const walletAddress = publicKey?.toBase58() ?? '';

  const loadFees = useCallback((w: string) => {
    setLoading(true);
    setError(null);
    fetchFeeSnapshot(w)
      .then(setSnapshot)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load fees when wallet connects
  useEffect(() => {
    if (walletAddress) {
      loadFees(walletAddress);
    } else {
      setSnapshot(null);
    }
  }, [walletAddress, loadFees]);

  // Auto-refresh every 30s when wallet is connected
  useEffect(() => {
    if (!walletAddress) return;
    const id = setInterval(() => loadFees(walletAddress), 30_000);
    return () => clearInterval(id);
  }, [walletAddress, loadFees]);

  const handleClaim = useCallback(async (tokenMint: string) => {
    if (!walletAddress || !signTransaction) return;

    setClaimStates((s) => ({ ...s, [tokenMint]: 'building' }));
    setClaimErrors((s) => ({ ...s, [tokenMint]: '' }));

    try {
      // 1. Get unsigned transactions from backend
      const { transactions } = await fetchClaimTransactions(walletAddress, tokenMint);

      if (!transactions.length) {
        throw new Error('No claim transactions returned');
      }

      // 2. Sign and send each transaction
      for (const txData of transactions) {
        setClaimStates((s) => ({ ...s, [tokenMint]: 'signing' }));

        // Decode base58 → Transaction
        const txBytes = bs58.decode(txData.tx);
        const tx = Transaction.from(txBytes);

        // Sign with wallet
        const signed = await signTransaction(tx);

        setClaimStates((s) => ({ ...s, [tokenMint]: 'sending' }));

        // Send signed transaction
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        // Wait for confirmation
        await connection.confirmTransaction(sig, 'confirmed');
      }

      setClaimStates((s) => ({ ...s, [tokenMint]: 'success' }));

      // Refresh fees after 2s to show updated balances
      setTimeout(() => {
        if (walletAddress) loadFees(walletAddress);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      setClaimStates((s) => ({ ...s, [tokenMint]: 'error' }));
      setClaimErrors((s) => ({ ...s, [tokenMint]: msg }));
    }
  }, [walletAddress, signTransaction, connection, loadFees]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Fee Optimizer</h2>
        <p className="text-gray-400 text-sm">Discover and claim creator fees from Bags positions</p>
      </div>

      {/* Wallet connect */}
      <div className="flex justify-center">
        <WalletMultiButton className="!bg-sentinel-accent hover:!bg-sentinel-accent-dim !rounded-lg !text-sm !font-medium !h-10 !px-5" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-16 space-y-4 animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-sentinel-accent/10 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-sentinel-accent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm">Checking claimable fees…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-xl p-5 text-center space-y-2 animate-fade-in">
          <p className="text-sentinel-danger font-semibold">Failed to load fees</p>
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
      {snapshot && !loading && !error && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary card */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Claimable</p>
                <p className="text-3xl font-bold text-sentinel-safe mt-1">
                  {formatUsd(snapshot.totalClaimableUsd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Positions</p>
                <p className="text-lg font-semibold text-white">{snapshot.positions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sentinel-border/50">
              <code className="text-[11px] text-gray-500 truncate flex-1">{snapshot.wallet}</code>
              <span className="text-[10px] text-gray-600">
                Updated {new Date(snapshot.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Positions list */}
          {snapshot.positions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Claimable Positions
              </h3>
              {snapshot.positions
                .sort((a, b) => b.claimableUsd - a.claimableUsd)
                .map((pos, i) => (
                  <PositionRow
                    key={pos.tokenMint}
                    pos={pos}
                    rank={i + 1}
                    onClaim={handleClaim}
                    claimState={claimStates[pos.tokenMint] ?? 'idle'}
                    claimError={claimErrors[pos.tokenMint] ?? null}
                  />
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm">No claimable fees found for this wallet.</p>
              <p className="text-xs text-gray-600 mt-1">
                Fees accrue from Bags token creator positions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state: wallet not connected */}
      {!connected && !loading && (
        <div className="text-center py-12 text-gray-600 space-y-3 animate-fade-in">
          <p className="text-4xl">💰</p>
          <p className="text-sm">Connect your wallet to discover unclaimed Bags creator fees</p>
          <div className="flex flex-wrap justify-center gap-2 text-[10px] text-gray-600">
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">Auto Fee Discovery</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">One-Click Claim</span>
            <span className="bg-sentinel-surface px-2 py-1 rounded border border-sentinel-border/50">v1 + v2 Positions</span>
          </div>
        </div>
      )}
    </div>
  );
}
