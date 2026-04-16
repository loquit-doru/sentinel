import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { PendingClaim, FeeUrgency } from '../../../shared/types';
import { fetchPendingClaim, fetchClaimTransactions, markClaimDone } from '../api';

function deserializeTx(base58Str: string): Transaction | VersionedTransaction {
  const bytes = bs58.decode(base58Str);
  if (bytes[0] >= 0x80) return VersionedTransaction.deserialize(bytes);
  return Transaction.from(bytes);
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

const URGENCY_ICON: Record<FeeUrgency, string> = {
  critical: '🚨',
  warning: '⚠️',
  safe: '✅',
  unknown: '❓',
};

type ClaimStep = 'loading' | 'ready' | 'signing' | 'sending' | 'confirming' | 'done' | 'error' | 'expired';

export function ClaimPage({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [claim, setClaim] = useState<PendingClaim | null>(null);
  const [step, setStep] = useState<ClaimStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100
  const [txSignatures, setTxSignatures] = useState<string[]>([]);
  const [claimedCount, setClaimedCount] = useState(0);

  const walletAddress = publicKey?.toBase58() ?? '';

  // Load claim data
  useEffect(() => {
    fetchPendingClaim(claimId)
      .then((data) => {
        setClaim(data);
        setStep(data.status === 'claimed' ? 'done' : 'ready');
      })
      .catch((err) => {
        setError(err.message);
        setStep('expired');
      });
  }, [claimId]);

  // Authorization check
  const isAuthorized = claim && walletAddress === claim.wallet;

  const handleClaimAll = useCallback(async () => {
    if (!claim || !signTransaction || !isAuthorized) return;

    const positions = claim.positions.filter((p) => p.claimableUsd > 0);
    if (!positions.length) return;

    setStep('signing');
    setProgress(0);
    setError(null);

    const totalPositions = positions.length;
    const sigs: string[] = [];
    let done = 0;

    for (const pos of positions) {
      try {
        // Build claim TX via API
        setStep('signing');
        const { transactions } = await fetchClaimTransactions(claim.wallet, pos.tokenMint);

        for (const txData of transactions) {
          const tx = deserializeTx(txData.tx);
          const signed = await signTransaction(tx);

          setStep('sending');
          const rawTx = signed.serialize();
          const sig = await connection.sendRawTransaction(rawTx, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          setStep('confirming');
          await connection.confirmTransaction(
            { signature: sig, blockhash: txData.blockhash, lastValidBlockHeight: txData.lastValidBlockHeight },
            'confirmed',
          );
          sigs.push(sig);
        }

        done++;
        setClaimedCount(done);
        setProgress(Math.round((done / totalPositions) * 100));
      } catch (err) {
        // Continue with remaining positions
        console.error(`Failed to claim ${pos.tokenSymbol}:`, err);
        done++;
        setProgress(Math.round((done / totalPositions) * 100));
      }
    }

    setTxSignatures(sigs);

    if (sigs.length > 0) {
      setStep('done');
      // Mark claim as completed on backend
      markClaimDone(claimId).catch(() => {});
    } else {
      setStep('error');
      setError('All claim transactions failed. Please try again.');
    }
  }, [claim, signTransaction, isAuthorized, claimId, connection]);

  const stepConfig: Record<ClaimStep, { icon: string; title: string; subtitle: string; color: string }> = {
    loading: { icon: '⏳', title: 'Loading claim…', subtitle: 'Fetching your pending fees', color: 'text-gray-400' },
    ready: { icon: '💰', title: 'Ready to Claim', subtitle: 'Connect wallet and claim in one click', color: 'text-sentinel-accent' },
    signing: { icon: '✍️', title: 'Sign Transaction', subtitle: 'Approve in your wallet…', color: 'text-yellow-400' },
    sending: { icon: '📡', title: 'Sending…', subtitle: 'Broadcasting to Solana…', color: 'text-yellow-400' },
    confirming: { icon: '⏳', title: 'Confirming…', subtitle: 'Waiting for network confirmation…', color: 'text-yellow-400' },
    done: { icon: '✅', title: 'Claimed!', subtitle: 'Fees successfully claimed', color: 'text-green-400' },
    error: { icon: '❌', title: 'Error', subtitle: error ?? 'Something went wrong', color: 'text-red-400' },
    expired: { icon: '⏰', title: 'Expired', subtitle: 'This claim link has expired', color: 'text-gray-500' },
  };

  const sc = stepConfig[step];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-sentinel-bg">
      {/* Sentinel branding */}
      <div className="mb-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-sentinel-accent/10 border border-sentinel-accent/30 flex items-center justify-center mb-3">
          <span className="text-sentinel-accent text-2xl font-bold">S</span>
        </div>
        <h1 className="text-lg font-bold text-white">Sentinel AutoClaim</h1>
        <p className="text-xs text-gray-500 mt-1">Risk-aware fee intelligence</p>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md bg-sentinel-surface border border-sentinel-border rounded-2xl p-6 space-y-5 animate-fade-in">
        {/* Step indicator */}
        <div className="text-center space-y-2">
          <span className="text-4xl">{sc.icon}</span>
          <h2 className={`text-xl font-bold ${sc.color}`}>{sc.title}</h2>
          <p className="text-sm text-gray-400">{sc.subtitle}</p>
        </div>

        {/* Progress bar */}
        {(step === 'signing' || step === 'sending' || step === 'confirming') && (
          <div className="space-y-2">
            <div className="h-2 bg-sentinel-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-sentinel-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              {claimedCount} / {claim?.positions.length ?? 0} positions claimed
            </p>
          </div>
        )}

        {/* Claim summary (when ready) */}
        {step === 'ready' && claim && (
          <div className="space-y-3">
            <div className="bg-sentinel-bg rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Total unclaimed</span>
                <span className="text-lg font-bold text-sentinel-safe">{formatUsd(claim.totalClaimableUsd)}</span>
              </div>
              {claim.urgentClaimableUsd > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">🚨 Urgent</span>
                  <span className="text-sm font-semibold text-red-400">{formatUsd(claim.urgentClaimableUsd)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Positions</span>
                <span className="text-sm text-white">{claim.positions.length}</span>
              </div>
            </div>

            {/* Position list preview */}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {claim.positions.slice(0, 8).map((pos) => (
                <div
                  key={pos.tokenMint}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded bg-sentinel-bg/50"
                >
                  <div className="flex items-center gap-2">
                    <span>{URGENCY_ICON[pos.urgency]}</span>
                    <span className="text-white">{pos.tokenSymbol}</span>
                    {pos.riskScore !== null && (
                      <span className="text-gray-600">({pos.riskScore}/100)</span>
                    )}
                  </div>
                  <span className="text-sentinel-safe font-medium">{formatUsd(pos.claimableUsd)}</span>
                </div>
              ))}
              {claim.positions.length > 8 && (
                <p className="text-[10px] text-gray-600 text-center mt-1">
                  +{claim.positions.length - 8} more positions
                </p>
              )}
            </div>

            {/* Wallet connect + claim button */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-center">
                <WalletMultiButton className="!bg-sentinel-accent hover:!bg-sentinel-accent-dim !rounded-lg !text-sm !font-medium !h-10 !px-5" />
              </div>

              {connected && !isAuthorized && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-400">
                    Wrong wallet. Connect <code className="text-[10px]">{claim.wallet.slice(0, 6)}…{claim.wallet.slice(-4)}</code> to claim.
                  </p>
                </div>
              )}

              {isAuthorized && (
                <button
                  onClick={handleClaimAll}
                  className="w-full py-3 rounded-xl bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold text-sm transition-all active:scale-[0.98]"
                >
                  ⚡ Claim {formatUsd(claim.totalClaimableUsd)} Now
                </button>
              )}
            </div>

            {/* Expiry notice */}
            <p className="text-[10px] text-gray-600 text-center">
              Expires {new Date(claim.expiresAt).toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div className="space-y-4">
            {txSignatures.length > 0 && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 space-y-1">
                <p className="text-xs text-green-400 font-semibold">{txSignatures.length} transaction(s) confirmed</p>
                {txSignatures.slice(0, 3).map((sig) => (
                  <a
                    key={sig}
                    href={`https://solscan.io/tx/${sig}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sentinel-accent hover:underline block truncate"
                  >
                    {sig.slice(0, 16)}…{sig.slice(-8)} ↗
                  </a>
                ))}
                {txSignatures.length > 3 && (
                  <p className="text-[10px] text-gray-600">+{txSignatures.length - 3} more</p>
                )}
              </div>
            )}
            <button
              onClick={onDone}
              className="w-full py-2.5 rounded-lg border border-sentinel-border text-sm text-gray-400 hover:text-white hover:border-sentinel-accent transition-all"
            >
              Open Dashboard →
            </button>
          </div>
        )}

        {/* Expired */}
        {step === 'expired' && (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-500">This claim link is no longer valid.</p>
            <button
              onClick={onDone}
              className="text-sm text-sentinel-accent hover:underline"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Error with retry */}
        {step === 'error' && (
          <div className="space-y-3">
            <button
              onClick={handleClaimAll}
              className="w-full py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-all"
            >
              Retry Claim
            </button>
            <button
              onClick={onDone}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-[10px] text-gray-600">
        Sentinel — Don't trade blind · Powered by{' '}
        <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent hover:underline">
          Bags
        </a>
      </p>
    </div>
  );
}
