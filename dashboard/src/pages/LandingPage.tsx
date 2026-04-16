import { useEffect, useState } from 'react';
import { fetchTokenFeed, fetchApiStats } from '../api';

interface LiveStats {
  tokensTracked: number;
  totalApiCalls: number;
  riskScans: number;
  todayCalls: number;
  loading: boolean;
}

function useLiveStats(): LiveStats {
  const [stats, setStats] = useState<LiveStats>({
    tokensTracked: 0, totalApiCalls: 0, riskScans: 0, todayCalls: 0, loading: true,
  });

  useEffect(() => {
    Promise.all([fetchTokenFeed(), fetchApiStats()])
      .then(([tokens, apiStats]) => {
        setStats({
          tokensTracked: tokens.length,
          totalApiCalls: apiStats?.totalRequests ?? 0,
          riskScans: apiStats?.byEndpoint.risk ?? 0,
          todayCalls: apiStats?.today.total ?? 0,
          loading: false,
        });
      })
      .catch(() => setStats((s) => ({ ...s, loading: false })));
  }, []);

  return stats;
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="relative bg-gradient-to-br from-sentinel-surface/80 to-sentinel-surface/40 rounded-xl p-6 transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(31,41,55,0.8)' }}>
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(6,182,212,0.2)' }} />
      <div className="text-2xl mb-4 w-10 h-10 rounded-lg bg-sentinel-accent/10 flex items-center justify-center">{icon}</div>
      <h3 className="text-white font-semibold mb-2 tracking-tight">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-4 sm:px-8">
      <p className="text-3xl sm:text-4xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-600 mt-1.5 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function SentinelLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3L4 8v8c0 6.627 5.148 12.347 12 13.93C22.852 28.347 28 22.627 28 16V8L16 3z"
        fill="rgba(6,182,212,0.12)"
        stroke="rgba(6,182,212,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.5" fill="#06b6d4" />
      <path d="M16 10v2M16 20v2M10 16h2M20 16h2" stroke="#06b6d4" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const stats = useLiveStats();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-sentinel-border/30 backdrop-blur-sm bg-sentinel-bg/90 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <SentinelLogo size={32} />
          <span className="text-lg font-bold tracking-tight">Sentinel</span>
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
        {/* Background glows — two smaller, positioned */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-cyan-500/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute top-2/3 left-1/3 w-[200px] h-[200px] bg-indigo-500/6 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-sentinel-surface/80 backdrop-blur-sm border border-sentinel-border/60 rounded-full px-4 py-1.5 text-xs text-gray-400 shadow-sm">
            <span className="w-1.5 h-1.5 bg-sentinel-safe rounded-full animate-pulse" />
            Built on Bags · Track: AI Agents
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
            Don't trade{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              blind.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-gray-400 max-w-md mx-auto leading-relaxed">
            AI risk intelligence for Bags tokens.
            Score any token 0–100, discover unclaimed fees, and claim in one click.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onLaunch}
              className="bg-sentinel-accent hover:bg-sentinel-accent-dim text-white font-semibold px-8 py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-xl hover:shadow-sentinel-accent/25 hover:-translate-y-0.5"
            >
              Launch App →
            </button>
            <a
              href="https://sentinel-api.apiworkersdev.workers.dev/health"
              target="_blank"
              rel="noopener"
              className="text-gray-500 hover:text-gray-300 text-sm font-medium px-6 py-3.5 rounded-xl border border-sentinel-border/50 hover:border-sentinel-border/80 transition-all hover:-translate-y-0.5"
            >
              View API ↗
            </a>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="border-y border-sentinel-border/30 bg-sentinel-surface/20 py-10 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-center divide-x divide-sentinel-border/40">
          <StatBox
            value={stats.loading ? '—' : stats.tokensTracked.toString()}
            label="Tokens Tracked"
          />
          <StatBox
            value={stats.loading ? '—' : stats.totalApiCalls.toLocaleString()}
            label="API Calls"
          />
          <StatBox
            value={stats.loading ? '—' : stats.riskScans.toLocaleString()}
            label="Risk Scans"
          />
          <StatBox value="<1s" label="Avg Response" />
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
      <footer className="border-t border-sentinel-border/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-[11px] text-gray-600">
          <div className="flex items-center gap-2">
            <SentinelLogo size={14} />
            <span>Sentinel v0.9.0 — AI Risk Intelligence for Bags</span>
          </div>
          <a href="https://bags.fm" target="_blank" rel="noopener" className="text-sentinel-accent/60 hover:text-sentinel-accent transition-colors">
            bags.fm ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
