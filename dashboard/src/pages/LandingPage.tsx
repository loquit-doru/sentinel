import { useEffect, useState } from 'react';
import { fetchTokenFeed } from '../api';

interface LiveStats {
  tokensTracked: number;
  loading: boolean;
}

function useLiveStats(): LiveStats {
  const [tokensTracked, setTokensTracked] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenFeed()
      .then((t) => setTokensTracked(t.length))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { tokensTracked, loading };
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-sentinel-surface/60 border border-sentinel-border/50 rounded-xl p-6 hover:border-sentinel-accent/30 transition-all group">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-1.5">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const { tokensTracked, loading } = useLiveStats();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-sentinel-border/30 backdrop-blur-sm bg-sentinel-bg/80 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sentinel-accent/10 border border-sentinel-accent/30 flex items-center justify-center">
            <span className="text-sentinel-accent text-lg font-bold">S</span>
          </div>
          <span className="text-lg font-bold">Sentinel</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener"
            className="text-xs text-gray-500 hover:text-sentinel-accent transition-colors hidden sm:inline"
          >
            bags.fm ↗
          </a>
          <button
            onClick={onLaunch}
            className="bg-sentinel-accent hover:bg-sentinel-accent-dim text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 sm:py-32 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sentinel-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-sentinel-surface border border-sentinel-border/50 rounded-full px-4 py-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 bg-sentinel-safe rounded-full animate-pulse" />
            Built on Bags · Track: AI Agents
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1]">
            Don't trade{' '}
            <span className="text-sentinel-accent">blind.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-lg mx-auto leading-relaxed">
            AI risk intelligence for Bags tokens.
            Score any token 0–100, discover unclaimed fees, and claim in one click.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onLaunch}
              className="bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold px-8 py-3 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-sentinel-accent/20"
            >
              Launch App →
            </button>
            <a
              href="https://sentinel-api.apiworkersdev.workers.dev/health"
              target="_blank"
              rel="noopener"
              className="text-gray-400 hover:text-white text-sm font-medium px-6 py-3 rounded-xl border border-sentinel-border/50 hover:border-sentinel-border transition-all"
            >
              View API ↗
            </a>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="border-y border-sentinel-border/30 bg-sentinel-surface/30 py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-around gap-6">
          <StatBox
            value={loading ? '…' : tokensTracked.toString()}
            label="Tokens Tracked"
          />
          <StatBox value="8" label="Risk Factors" />
          <StatBox value="3" label="Data Sources" />
          <StatBox value="<1s" label="Response Time" />
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Two pillars. Zero fluff.</h2>
            <p className="text-gray-400 mt-2 text-sm">
              Everything a Bags creator needs to trade safely and optimize revenue.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FeatureCard
              icon="🛡️"
              title="Risk Scoring Engine"
              desc="8-factor AI analysis: honeypot detection, LP lock, mint authority, holder distribution, liquidity depth, volume patterns, and more. Score 0–100 for any token."
            />
            <FeatureCard
              icon="💰"
              title="Auto Fee Optimizer"
              desc="Discover unclaimed creator fees across all your Bags positions. One-click claim with wallet signing. Supports v1 and v2 fee shares."
            />
            <FeatureCard
              icon="📡"
              title="Live Discovery Feed"
              desc="170+ tokens tracked in real-time. Filter by risk tier, sort by volume, fees, or FDV. Find the next opportunity before everyone else."
            />
            <FeatureCard
              icon="⚡"
              title="Edge Performance"
              desc="Powered by Cloudflare Workers — sub-second response times globally. KV caching with smart TTLs. No cold starts, ever."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 border-t border-sentinel-border/30 bg-sentinel-surface/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Score', desc: 'Paste any Bags token mint. Get a risk score from 0–100 with full breakdown.' },
              { step: '2', title: 'Discover', desc: 'Browse the live feed. Filter by risk tier. Spot safe tokens with high fees.' },
              { step: '3', title: 'Claim', desc: 'Connect wallet. See unclaimed fees. Claim all with one click.' },
            ].map((s) => (
              <div key={s.step} className="space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-sentinel-accent/10 border border-sentinel-accent/30 flex items-center justify-center text-sentinel-accent font-bold">
                  {s.step}
                </div>
                <h3 className="text-white font-semibold">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-lg mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Ready to trade smarter?</h2>
          <p className="text-gray-400 text-sm">
            Free to use. No sign-up required. Just connect your wallet and go.
          </p>
          <button
            onClick={onLaunch}
            className="bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold px-8 py-3 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-sentinel-accent/20"
          >
            Launch App →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sentinel-border/30 px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-sentinel-accent font-bold">S</span>
            <span>Sentinel v0.1.0 — AI Risk Intelligence for Bags</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Track: AI Agents</span>
            <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent hover:underline">
              bags.fm ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
