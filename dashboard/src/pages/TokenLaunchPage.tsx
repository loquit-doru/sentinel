import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  createTokenInfo,
  createFeeConfig,
  createLaunchTransaction,
  type CreateTokenParams,
  type FeeClaimerEntry,
} from '../api';

const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=2aa0a622-7e63-41c8-8b96-14b8b9b667eb';
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Step = 'details' | 'fees' | 'review' | 'launching' | 'done';

interface LaunchState {
  tokenMint?: string;
  metadataUrl?: string;
  configKey?: string;
  launchTxSig?: string;
}

export function TokenLaunchPage() {
  const { publicKey, signTransaction, connected } = useWallet();

  const [step, setStep] = useState<Step>('details');
  const [error, setError] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<LaunchState>({});

  // ── Step 1: Token details ──────────────────────────────
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');

  // ── Step 2: Fee shares ─────────────────────────────────
  const [feeClaimers, setFeeClaimers] = useState<FeeClaimerEntry[]>([
    { user: '', userBps: 5000 },
    { user: '', userBps: 3000 },
    { user: '', userBps: 2000 },
  ]);

  // ── Step 3: Initial buy ────────────────────────────────
  const [initialBuySol, setInitialBuySol] = useState('0');

  // ── Status messages ────────────────────────────────────
  const [statusMsg, setStatusMsg] = useState('');

  const totalBps = feeClaimers.reduce((s, e) => s + e.userBps, 0);

  const canProceedDetails = name.trim() && symbol.trim() && description.trim() && imageUrl.trim();
  const canProceedFees = totalBps === 10_000 && feeClaimers.every((e) => SOLANA_ADDR_RE.test(e.user));

  const updateClaimer = (idx: number, field: 'user' | 'userBps', value: string | number) => {
    setFeeClaimers((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
    );
  };

  const addClaimer = () => {
    setFeeClaimers((prev) => [...prev, { user: '', userBps: 0 }]);
  };

  const removeClaimer = (idx: number) => {
    if (feeClaimers.length <= 1) return;
    setFeeClaimers((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Launch flow (multi-step on-chain) ──────────────────
  const handleLaunch = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    setStep('launching');
    setError(null);
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    try {
      // 1. Create token metadata
      setStatusMsg('Creating token metadata on Bags...');
      const tokenInfo = await createTokenInfo({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        telegram: telegram.trim() || undefined,
      });
      setLaunchState((s) => ({
        ...s,
        tokenMint: tokenInfo.tokenMint,
        metadataUrl: tokenInfo.metadataUrl,
      }));

      // 2. Create fee-share config
      setStatusMsg('Building fee-share config transactions...');
      const feeConfig = await createFeeConfig(feeClaimers, publicKey.toBase58());
      setLaunchState((s) => ({ ...s, configKey: feeConfig.meteoraConfigKey }));

      // Sign & send fee config transactions
      if (feeConfig.transactions.length > 0) {
        setStatusMsg(`Signing ${feeConfig.transactions.length} fee config tx(s)...`);
        for (let i = 0; i < feeConfig.transactions.length; i++) {
          const txData = feeConfig.transactions[i];
          const txBytes = bs58.decode(txData.tx);
          const tx = VersionedTransaction.deserialize(txBytes);
          const signed = await signTransaction(tx);
          const sig = await connection.sendRawTransaction(signed.serialize());
          await connection.confirmTransaction({
            signature: sig,
            blockhash: txData.blockhash,
            lastValidBlockHeight: txData.lastValidBlockHeight,
          });
          setStatusMsg(`Fee config tx ${i + 1}/${feeConfig.transactions.length} confirmed`);
        }
      }

      // 3. Create & sign launch transaction
      setStatusMsg('Building launch transaction...');
      const launchTx = await createLaunchTransaction({
        tokenMint: tokenInfo.tokenMint,
        launchWallet: publicKey.toBase58(),
        metadataUrl: tokenInfo.metadataUrl,
        configKey: feeConfig.meteoraConfigKey,
        initialBuyLamports: Math.round(parseFloat(initialBuySol || '0') * 1_000_000_000),
      });

      setStatusMsg('Sign the launch transaction in your wallet...');
      const txBytes = bs58.decode(launchTx.transaction);
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction({
        signature: sig,
        blockhash: launchTx.blockhash,
        lastValidBlockHeight: launchTx.lastValidBlockHeight,
      });

      setLaunchState((s) => ({ ...s, launchTxSig: sig }));
      setStatusMsg('');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
      setStep('review');
    }
  }, [publicKey, signTransaction, name, symbol, description, imageUrl, website, twitter, telegram, feeClaimers, initialBuySol]);

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Launch Token on Bags</h2>
        <p className="text-gray-400 text-sm">
          Create a new token with custom fee-share configuration directly on Bags.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {(['details', 'fees', 'review'] as const).map((s, i) => {
            const labels = ['Token Details', 'Fee Shares', 'Review & Launch'];
            const stepIdx = ['details', 'fees', 'review'].indexOf(step);
            const isActive = step === s || (step === 'launching' && s === 'review') || (step === 'done' && s === 'review');
            const isDone = i < stepIdx || step === 'done';
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isDone ? 'bg-sentinel-accent' : 'bg-sentinel-border'}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-sentinel-accent/10 text-sentinel-accent border border-sentinel-accent/30'
                    : isDone
                    ? 'bg-sentinel-safe/10 text-sentinel-safe border border-sentinel-safe/30'
                    : 'bg-sentinel-surface text-gray-500 border border-sentinel-border/50'
                }`}>
                  {isDone ? '✓' : i + 1}
                  <span className="hidden sm:inline">{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wallet connection required */}
      {!connected && (
        <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">Connect your wallet to launch a token</p>
          <WalletMultiButton />
        </div>
      )}

      {connected && step === 'details' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Token Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sentinel"
                  className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Symbol *</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="SENT"
                  maxLength={10}
                  className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="AI risk intelligence for Bags creators. Don't trade blind."
                rows={3}
                className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Image URL *</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/sentinel-logo.png"
                className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
              />
              {imageUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="w-12 h-12 rounded-lg object-cover border border-sentinel-border/50"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-gray-500">Preview</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Website</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Twitter</label>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@sentinel"
                  className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Telegram</label>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="t.me/sentinel"
                  className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm focus:border-sentinel-accent/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep('fees')}
              disabled={!canProceedDetails}
              className="px-6 py-2.5 rounded-lg bg-sentinel-accent text-sentinel-bg font-medium text-sm hover:bg-sentinel-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next: Fee Shares →
            </button>
          </div>
        </div>
      )}

      {connected && step === 'fees' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">Fee Distribution</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allocate 100% (10,000 bps) across wallets. 1 bps = 0.01%.
                </p>
              </div>
              <div className={`text-xs font-mono px-2 py-1 rounded ${
                totalBps === 10_000
                  ? 'bg-sentinel-safe/10 text-sentinel-safe'
                  : 'bg-sentinel-danger/10 text-sentinel-danger'
              }`}>
                {totalBps.toLocaleString()} / 10,000 bps
              </div>
            </div>

            {feeClaimers.map((claimer, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Wallet {idx + 1}</label>
                  <input
                    value={claimer.user}
                    onChange={(e) => updateClaimer(idx, 'user', e.target.value)}
                    placeholder="Solana wallet address"
                    className={`w-full bg-sentinel-bg border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none ${
                      claimer.user && !SOLANA_ADDR_RE.test(claimer.user)
                        ? 'border-sentinel-danger/50 focus:border-sentinel-danger'
                        : 'border-sentinel-border/50 focus:border-sentinel-accent/50'
                    }`}
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-gray-500 mb-1">Share (bps)</label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={claimer.userBps}
                    onChange={(e) => updateClaimer(idx, 'userBps', parseInt(e.target.value) || 0)}
                    className="w-full bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:border-sentinel-accent/50 focus:outline-none"
                  />
                </div>
                <div className="w-14 text-right">
                  <span className="text-xs text-gray-500">{(claimer.userBps / 100).toFixed(1)}%</span>
                </div>
                {feeClaimers.length > 1 && (
                  <button
                    onClick={() => removeClaimer(idx)}
                    className="pb-2 text-gray-600 hover:text-sentinel-danger transition-colors text-lg"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addClaimer}
              className="text-xs text-sentinel-accent hover:text-sentinel-accent/80 transition-colors"
            >
              + Add wallet
            </button>
          </div>

          {/* Quick presets */}
          <div className="bg-sentinel-surface/50 border border-sentinel-border/30 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Quick presets:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '50/30/20', splits: [5000, 3000, 2000] },
                { label: '60/20/20', splits: [6000, 2000, 2000] },
                { label: '33/33/34', splits: [3300, 3300, 3400] },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setFeeClaimers((prev) =>
                      preset.splits.map((bps, i) => ({
                        user: prev[i]?.user ?? '',
                        userBps: bps,
                      })),
                    )
                  }
                  className="text-xs px-3 py-1.5 rounded-lg bg-sentinel-bg border border-sentinel-border/50 hover:border-sentinel-accent/30 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('details')}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!canProceedFees}
              className="px-6 py-2.5 rounded-lg bg-sentinel-accent text-sentinel-bg font-medium text-sm hover:bg-sentinel-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {connected && step === 'review' && (
        <div className="space-y-4 animate-fade-in">
          {error && (
            <div className="p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg">
              <p className="text-sm text-sentinel-danger">{error}</p>
            </div>
          )}

          {/* Token summary */}
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Token Summary</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-medium">{name}</p>
              </div>
              <div>
                <span className="text-gray-500">Symbol</span>
                <p className="font-medium font-mono">${symbol.toUpperCase()}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Description</span>
                <p className="text-gray-300">{description}</p>
              </div>
              {imageUrl && (
                <div className="col-span-2 flex items-center gap-3">
                  <img src={imageUrl} alt="token" className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-xs text-gray-500 break-all">{imageUrl}</span>
                </div>
              )}
            </div>
          </div>

          {/* Fee distribution summary */}
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Fee Distribution</h3>
            <div className="space-y-2">
              {feeClaimers.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-gray-400 truncate max-w-[300px]">{c.user}</span>
                  <span className="font-medium text-sentinel-accent">{(c.userBps / 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Initial buy */}
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-3">Initial Buy (optional)</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                step={0.01}
                value={initialBuySol}
                onChange={(e) => setInitialBuySol(e.target.value)}
                className="w-32 bg-sentinel-bg border border-sentinel-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:border-sentinel-accent/50 focus:outline-none"
              />
              <span className="text-sm text-gray-400">SOL</span>
              <span className="text-xs text-gray-600">(set 0 to skip initial purchase)</span>
            </div>
          </div>

          {/* Launch button */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('fees')}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleLaunch}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-sentinel-accent to-cyan-400 text-sentinel-bg font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-sentinel-accent/20"
            >
              Launch on Bags
            </button>
          </div>
        </div>
      )}

      {connected && step === 'launching' && (
        <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-8 text-center animate-fade-in">
          <div className="w-12 h-12 border-2 border-sentinel-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sentinel-accent font-medium mb-2">Launching...</p>
          <p className="text-sm text-gray-400">{statusMsg}</p>
          {launchState.tokenMint && (
            <p className="text-xs text-gray-600 mt-3 font-mono">Mint: {launchState.tokenMint}</p>
          )}
        </div>
      )}

      {connected && step === 'done' && (
        <div className="bg-sentinel-surface border border-sentinel-safe/30 rounded-xl p-8 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-sentinel-safe/10 border border-sentinel-safe/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h3 className="text-xl font-bold mb-2 text-sentinel-safe">Token Launched!</h3>
          <p className="text-sm text-gray-400 mb-6">
            ${symbol.toUpperCase()} is now live on Bags.
          </p>

          <div className="space-y-3 text-left bg-sentinel-bg/50 rounded-lg p-4 text-sm">
            <div>
              <span className="text-gray-500">Token Mint:</span>
              <p className="font-mono text-xs break-all text-gray-300">{launchState.tokenMint}</p>
            </div>
            {launchState.configKey && (
              <div>
                <span className="text-gray-500">Fee Config Key:</span>
                <p className="font-mono text-xs break-all text-gray-300">{launchState.configKey}</p>
              </div>
            )}
            {launchState.launchTxSig && (
              <div>
                <span className="text-gray-500">Transaction:</span>
                <a
                  href={`https://solscan.io/tx/${launchState.launchTxSig}`}
                  target="_blank"
                  rel="noopener"
                  className="block font-mono text-xs break-all text-sentinel-accent hover:underline"
                >
                  {launchState.launchTxSig}
                </a>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {launchState.tokenMint && (
              <a
                href={`https://bags.fm/token/${launchState.tokenMint}`}
                target="_blank"
                rel="noopener"
                className="px-5 py-2 rounded-lg bg-sentinel-accent text-sentinel-bg font-medium text-sm hover:bg-sentinel-accent/90 transition-colors"
              >
                View on Bags ↗
              </a>
            )}
            <button
              onClick={() => {
                setStep('details');
                setLaunchState({});
                setName('');
                setSymbol('');
                setDescription('');
                setImageUrl('');
                setError(null);
              }}
              className="px-5 py-2 rounded-lg border border-sentinel-border/50 text-gray-400 text-sm hover:text-gray-200 transition-colors"
            >
              Launch Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
