import { useState, useCallback, useEffect } from 'react';
import { fetchWalletXRay, type XRayResult, type XRayToken } from '../api';

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'safe': return 'text-sentinel-safe';
    case 'caution': return 'text-sentinel-caution';
    case 'danger': return 'text-sentinel-danger';
    case 'rug': return 'text-red-800';
    default: return 'text-gray-500';
  }
}

function tierBg(tier: string | null): string {
  switch (tier) {
    case 'safe': return 'bg-sentinel-safe/10 border-sentinel-safe/30';
    case 'caution': return 'bg-sentinel-caution/10 border-sentinel-caution/30';
    case 'danger': return 'bg-sentinel-danger/10 border-sentinel-danger/30';
    case 'rug': return 'bg-red-900/20 border-red-800/40';
    default: return 'bg-sentinel-surface border-sentinel-border/50';
  }
}

function healthColor(score: number): string {
  if (score >= 70) return 'text-sentinel-safe';
  if (score >= 40) return 'text-sentinel-caution';
  return 'text-sentinel-danger';
}

function healthLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Dangerous';
}

function TokenRow({ token, onView }: { token: XRayToken; onView: (mint: string) => void }) {
  const shortMint = `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${tierBg(token.tier)}`}
      onClick={() => onView(token.mint)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-gray-300 truncate">{shortMint}</p>
        <p className="text-xs text-gray-500">
          {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens
        </p>
      </div>

      <div className="text-right">
        {token.score !== null ? (
          <>
            <p className={`text-lg font-bold ${tierColor(token.tier)}`}>{token.score}</p>
            <p className={`text-[10px] uppercase font-medium tracking-wide ${tierColor(token.tier)}`}>
              {token.tier}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600">—</p>
        )}
      </div>

      <div className="text-gray-600 text-xs">→</div>
    </div>
  );
}

interface Props {
  onViewToken: (mint: string) => void;
  connectedWallet: string | null;
}

export function WalletXRayPage({ onViewToken, connectedWallet }: Props) {
  const [wallet, setWallet] = useState('');
  const [result, setResult] = useState<XRayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill when wallet connects and input is empty
  useEffect(() => {
    if (connectedWallet && !wallet && !result) {
      setWallet(connectedWallet);
    }
  }, [connectedWallet, wallet, result]);

  const scan = useCallback(async () => {
    const trimmed = wallet.trim();
    if (!SOLANA_ADDR_RE.test(trimmed)) {
      setError('Invalid Solana wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchWalletXRay(trimmed);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') scan();
  };

  const flagged = result?.holdings.filter((t) => t.score !== null && t.score < 40) ?? [];
  const sorted = result?.holdings.slice().sort((a, b) => (a.score ?? 999) - (b.score ?? 999)) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Wallet X-Ray</h2>
        <p className="text-gray-400 text-sm">
          Paste any Solana wallet to scan all token holdings for risk.
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-6">
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connectedWallet ? 'Using connected wallet...' : 'Solana wallet address...'}
          className="flex-1 bg-sentinel-surface border border-sentinel-border/50 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-sentinel-accent/50 focus:outline-none placeholder-gray-600"
        />
        <button
          onClick={scan}
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-sentinel-accent text-sentinel-bg font-medium text-sm hover:bg-sentinel-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-lg">
          <p className="text-sm text-sentinel-danger">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-sentinel-accent/30 border-t-sentinel-accent rounded-full animate-spin mb-4" />
          <p className="text-gray-400 text-sm">Scanning wallet tokens & computing risk scores...</p>
          <p className="text-gray-600 text-xs mt-1">This may take a few seconds</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6 animate-fade-in">
          {/* Portfolio Health Card */}
          <div className="bg-sentinel-surface border border-sentinel-border/50 rounded-xl p-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Portfolio Health</p>
            <p className={`text-5xl font-bold ${healthColor(result.portfolioHealth)}`}>
              {result.portfolioHealth}
            </p>
            <p className={`text-sm font-medium mt-1 ${healthColor(result.portfolioHealth)}`}>
              {healthLabel(result.portfolioHealth)}
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
              <span>{result.holdings.length} tokens scanned</span>
              <span className={result.flaggedCount > 0 ? 'text-sentinel-danger font-medium' : ''}>
                {result.flaggedCount} flagged
              </span>
            </div>
          </div>

          {/* Flagged tokens alert */}
          {flagged.length > 0 && (
            <div className="p-4 bg-sentinel-danger/5 border border-sentinel-danger/20 rounded-xl">
              <p className="text-sm font-medium text-sentinel-danger mb-1">
                ⚠ {flagged.length} token{flagged.length > 1 ? 's' : ''} flagged as high risk
              </p>
              <p className="text-xs text-gray-400">
                These tokens scored below 40/100. Click for details.
              </p>
            </div>
          )}

          {/* Token list */}
          {result.holdings.length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                Holdings (sorted by risk — worst first)
              </p>
              <div className="space-y-2">
                {sorted.map((token) => (
                  <TokenRow key={token.mint} token={token} onView={onViewToken} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">No SPL tokens found in this wallet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
