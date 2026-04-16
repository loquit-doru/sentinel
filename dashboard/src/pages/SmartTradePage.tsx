import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { RiskTier } from '../../../shared/types';
import { TierBadge, ScoreGauge } from '../components/RiskDisplay';
import { fetchSwapQuote, fetchSwapTransaction } from '../api';
import type { SwapQuoteWithRisk } from '../api';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

type SwapState = 'idle' | 'quoting' | 'quoted' | 'building' | 'signing' | 'sending' | 'success' | 'error';

const TIER_WARNINGS: Record<RiskTier, { icon: string; msg: string; block: boolean }> = {
  safe: { icon: '✅', msg: 'Token looks safe. Standard caution applies.', block: false },
  caution: { icon: '⚠️', msg: 'Some risk factors detected. DYOR before swapping.', block: false },
  danger: { icon: '🚨', msg: 'HIGH RISK — Multiple red flags. You may lose your funds.', block: false },
  rug: { icon: '💀', msg: 'LIKELY SCAM — Extremely high rug probability. Swap blocked.', block: true },
};

function deserializeTx(base58Str: string): Transaction | VersionedTransaction {
  const bytes = bs58.decode(base58Str);
  if (bytes[0] >= 0x80) return VersionedTransaction.deserialize(bytes);
  return Transaction.from(bytes);
}

function shortenSig(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

function formatOutput(raw: string, decimals = 9): string {
  const num = Number(raw) / Math.pow(10, decimals);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num > 0) return num.toFixed(6);
  return '0';
}

export function SmartTradePage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [outputMint, setOutputMint] = useState('');
  const [solAmount, setSolAmount] = useState('');
  const [quoteData, setQuoteData] = useState<SwapQuoteWithRisk | null>(null);
  const [swapState, setSwapState] = useState<SwapState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [dangerAck, setDangerAck] = useState(false);

  const walletAddress = publicKey?.toBase58() ?? '';
  const mintValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(outputMint);
  const solNum = parseFloat(solAmount);
  const amountValid = !isNaN(solNum) && solNum > 0 && solNum <= 100;

  const riskScore = quoteData?.risk ?? null;
  const tier = riskScore?.tier ?? null;
  const warning = tier ? TIER_WARNINGS[tier] : null;
  const isBlocked = warning?.block ?? false;

  const getQuote = useCallback(async () => {
    if (!mintValid || !amountValid) return;
    setSwapState('quoting');
    setError(null);
    setQuoteData(null);
    setDangerAck(false);
    setTxSignature(null);

    try {
      const lamports = Math.round(solNum * LAMPORTS_PER_SOL);
      const data = await fetchSwapQuote(outputMint, lamports);
      setQuoteData(data);
      setSwapState('quoted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
      setSwapState('error');
    }
  }, [outputMint, solNum, mintValid, amountValid]);

  const executeSwap = useCallback(async () => {
    if (!walletAddress || !signTransaction || !quoteData || isBlocked) return;

    setSwapState('building');
    setError(null);
    setTxSignature(null);

    try {
      const lamports = Math.round(solNum * LAMPORTS_PER_SOL);
      const { transactions } = await fetchSwapTransaction({
        outputMint,
        amount: lamports,
        walletAddress,
      });

      if (!transactions.length) throw new Error('No transactions returned');

      let lastSig = '';
      for (const txData of transactions) {
        setSwapState('signing');
        const tx = deserializeTx(txData.tx);
        const signed = await signTransaction(tx);

        setSwapState('sending');
        const rawTx = signed instanceof VersionedTransaction
          ? signed.serialize()
          : signed.serialize();

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

      setTxSignature(lastSig);
      setSwapState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
      setSwapState('error');
    }
  }, [walletAddress, signTransaction, quoteData, outputMint, solNum, connection, isBlocked]);

  const isBusy = ['quoting', 'building', 'signing', 'sending'].includes(swapState);

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      {/* Title */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Smart Trade</h2>
        <p className="text-sm text-gray-500">Swap tokens with risk intelligence. See the score before you trade.</p>
      </div>

      {/* Wallet connect */}
      {!connected && (
        <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/30">
          <p className="text-sm text-gray-400">Connect your wallet to start trading</p>
          <WalletMultiButton className="!bg-sentinel-accent hover:!bg-sentinel-accent-dim !rounded-lg !h-10 !text-sm" />
        </div>
      )}

      {/* Swap form */}
      <div className="p-5 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/30 space-y-4">
        {/* You pay */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">You pay</label>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sentinel-bg border border-sentinel-border/50">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0.0"
              value={solAmount}
              onChange={(e) => { setSolAmount(e.target.value); setSwapState('idle'); }}
              className="flex-1 bg-transparent text-white text-lg font-mono outline-none placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-sm text-gray-400 font-medium shrink-0">SOL</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full border border-sentinel-border/50 flex items-center justify-center text-gray-500 text-sm">↓</div>
        </div>

        {/* You receive */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">You receive (token mint)</label>
          <input
            type="text"
            placeholder="Paste Solana token mint address..."
            value={outputMint}
            onChange={(e) => { setOutputMint(e.target.value.trim()); setSwapState('idle'); }}
            className="w-full p-3 rounded-lg bg-sentinel-bg border border-sentinel-border/50 text-white text-sm font-mono outline-none placeholder-gray-600 focus:border-sentinel-accent/50 transition-colors"
          />
          {outputMint && !mintValid && (
            <p className="text-xs text-sentinel-danger">Invalid Solana address</p>
          )}
        </div>

        {/* Quote button */}
        <button
          onClick={getQuote}
          disabled={!mintValid || !amountValid || isBusy}
          className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
            mintValid && amountValid && !isBusy
              ? 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white cursor-pointer'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {swapState === 'quoting' ? 'Getting quote & risk score…' : 'Get Quote'}
        </button>
      </div>

      {/* Risk Gate */}
      {quoteData && riskScore && tier && warning && (
        <div className={`p-5 rounded-xl border space-y-4 ${
          tier === 'safe' ? 'border-sentinel-safe/30 bg-sentinel-safe/5' :
          tier === 'caution' ? 'border-sentinel-caution/30 bg-sentinel-caution/5' :
          tier === 'danger' ? 'border-sentinel-danger/30 bg-sentinel-danger/5' :
          'border-sentinel-rug/30 bg-sentinel-rug/5'
        }`}>
          <div className="flex items-center gap-4">
            <ScoreGauge score={riskScore.score} tier={tier} size={80} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{warning.icon}</span>
                <TierBadge tier={tier} />
              </div>
              <p className="text-sm text-gray-300">{warning.msg}</p>
            </div>
          </div>

          {/* Danger acknowledgment */}
          {tier === 'danger' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dangerAck}
                onChange={(e) => setDangerAck(e.target.checked)}
                className="rounded border-sentinel-danger/50 bg-transparent text-sentinel-danger focus:ring-sentinel-danger/30"
              />
              <span className="text-xs text-gray-400">I understand the risks and want to proceed anyway</span>
            </label>
          )}
        </div>
      )}

      {/* Quote not available but risk score came back null */}
      {quoteData && !riskScore && swapState === 'quoted' && (
        <div className="p-3 rounded-lg border border-sentinel-caution/30 bg-sentinel-caution/5 text-sm text-gray-400">
          ⚠️ Risk score unavailable. Proceed with caution.
        </div>
      )}

      {/* Quote details */}
      {quoteData && swapState === 'quoted' && (
        <div className="p-4 rounded-xl border border-sentinel-border/50 bg-sentinel-surface/30 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Quote Preview</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">You pay</p>
              <p className="text-white font-mono">{solAmount} SOL</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">You receive (est.)</p>
              <p className="text-white font-mono">{formatOutput(quoteData.quote.outputAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Price impact</p>
              <p className={`font-mono ${quoteData.quote.priceImpactPct > 5 ? 'text-sentinel-danger' : quoteData.quote.priceImpactPct > 1 ? 'text-sentinel-caution' : 'text-gray-300'}`}>
                {quoteData.quote.priceImpactPct.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Slippage</p>
              <p className="text-gray-300 font-mono">{quoteData.quote.slippageMode}</p>
            </div>
          </div>
        </div>
      )}

      {/* Swap button */}
      {swapState === 'quoted' && connected && (
        <button
          onClick={executeSwap}
          disabled={isBlocked || (tier === 'danger' && !dangerAck)}
          className={`w-full py-3.5 rounded-lg font-semibold text-sm transition-all ${
            isBlocked
              ? 'bg-sentinel-rug/20 text-sentinel-rug border border-sentinel-rug/30 cursor-not-allowed'
              : tier === 'danger' && !dangerAck
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : tier === 'danger'
                  ? 'bg-sentinel-danger hover:bg-sentinel-danger/80 text-white'
                  : 'bg-sentinel-accent hover:bg-sentinel-accent-dim text-white'
          }`}
        >
          {isBlocked
            ? '🚫 Swap Blocked — Likely Scam'
            : tier === 'danger' && !dangerAck
              ? 'Acknowledge risk to swap'
              : tier === 'danger'
                ? '⚠️ Swap Anyway (High Risk)'
                : 'Swap'}
        </button>
      )}

      {/* In-progress states */}
      {['building', 'signing', 'sending'].includes(swapState) && (
        <div className="flex items-center justify-center gap-3 p-4 rounded-xl border border-sentinel-accent/30 bg-sentinel-accent/5">
          <div className="w-4 h-4 border-2 border-sentinel-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-sentinel-accent">
            {swapState === 'building' ? 'Building transaction…' :
             swapState === 'signing' ? 'Sign in your wallet…' :
             'Sending transaction…'}
          </span>
        </div>
      )}

      {/* Success */}
      {swapState === 'success' && txSignature && (
        <div className="p-4 rounded-xl border border-sentinel-safe/30 bg-sentinel-safe/5 space-y-2">
          <p className="text-sm text-sentinel-safe font-medium">✅ Swap successful!</p>
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sentinel-accent hover:underline"
          >
            View on Solscan: {shortenSig(txSignature)} ↗
          </a>
        </div>
      )}

      {/* Error */}
      {swapState === 'error' && error && (
        <div className="p-4 rounded-xl border border-sentinel-danger/30 bg-sentinel-danger/5">
          <p className="text-sm text-sentinel-danger">{error}</p>
          <button
            onClick={getQuote}
            className="text-xs text-sentinel-accent hover:underline mt-2"
          >
            Retry quote
          </button>
        </div>
      )}

      {/* Info */}
      <p className="text-center text-[10px] text-gray-600 leading-relaxed">
        Swaps powered by{' '}
        <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent hover:underline">Bags</a>
        {' '}· Risk scores by Sentinel · Not financial advice
      </p>
    </div>
  );
}
