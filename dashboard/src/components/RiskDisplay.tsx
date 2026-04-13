import type { RiskTier } from '../../../shared/types';

const TIER_COLORS: Record<RiskTier, string> = {
  safe: 'text-sentinel-safe',
  caution: 'text-sentinel-caution',
  danger: 'text-sentinel-danger',
  rug: 'text-sentinel-rug',
};

const TIER_BG: Record<RiskTier, string> = {
  safe: 'bg-sentinel-safe/10 border-sentinel-safe/30',
  caution: 'bg-sentinel-caution/10 border-sentinel-caution/30',
  danger: 'bg-sentinel-danger/10 border-sentinel-danger/30',
  rug: 'bg-sentinel-rug/10 border-sentinel-rug/30',
};

const TIER_RING: Record<RiskTier, string> = {
  safe: 'stroke-sentinel-safe',
  caution: 'stroke-sentinel-caution',
  danger: 'stroke-sentinel-danger',
  rug: 'stroke-sentinel-rug',
};

const TIER_GLOW: Record<RiskTier, string> = {
  safe: 'drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]',
  caution: 'drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]',
  danger: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]',
  rug: 'drop-shadow-[0_0_8px_rgba(153,27,27,0.3)]',
};

export function TierBadge({ tier }: { tier: RiskTier }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold uppercase rounded-full border ${TIER_BG[tier]} ${TIER_COLORS[tier]}`}>
      {tier}
    </span>
  );
}

export function ScoreGauge({ score, tier, size = 120 }: { score: number; tier: RiskTier; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${TIER_GLOW[tier]}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1f2937" strokeWidth="8"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth="8" strokeLinecap="round"
          className={`${TIER_RING[tier]} animate-gauge-fill`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${TIER_COLORS[tier]}`}>{score}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{tier}</span>
      </div>
    </div>
  );
}

export function BreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? 'bg-sentinel-safe' : pct >= 40 ? 'bg-sentinel-caution' : 'bg-sentinel-danger';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={`font-mono font-medium ${pct >= 70 ? 'text-sentinel-safe' : pct >= 40 ? 'text-sentinel-caution' : 'text-sentinel-danger'}`}>{pct}</span>
      </div>
      <div className="w-full h-1.5 bg-sentinel-border/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} animate-bar-fill`}
          style={{ width: `${pct}%`, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </div>
    </div>
  );
}
