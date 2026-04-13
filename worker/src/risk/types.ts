// ── RugCheck API types ────────────────────────────────────

export interface RugCheckRisk {
  name: string;
  value: string;
  description: string;
  score: number;
  level: 'info' | 'warn' | 'error' | 'danger';
}

export interface RugCheckHolder {
  address: string;
  amount: number;
  pct: number;
  uiAmount: number;
  owner: string;
  insider: boolean;
}

export interface RugCheckMarketLP {
  lpLockedPct: number;
  lpLocked: number;
  lpUnlocked: number;
  lpLockedUSD: number;
  quoteUSD: number;
  baseUSD: number;
}

export interface RugCheckMarket {
  pubkey: string;
  marketType: string;
  mintA: string;
  mintB: string;
  mintLP: string;
  lp: RugCheckMarketLP | null;
}

export interface RugCheckReport {
  mint: string;
  creator: string | null;
  creatorBalance: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  token: {
    mintAuthority: string | null;
    supply: number;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: string | null;
  } | null;
  tokenMeta: {
    name: string;
    symbol: string;
    uri: string;
    mutable: boolean;
    updateAuthority: string;
  } | null;
  topHolders: RugCheckHolder[] | null;
  risks: RugCheckRisk[] | null;
  score: number;
  score_normalised: number;
  markets: RugCheckMarket[] | null;
  totalMarketLiquidity: number;
  totalLPProviders: number;
  rugged: boolean;
}

// ── Birdeye API types ────────────────────────────────────

export interface BirdeyeTokenSecurity {
  ownerAddress: string | null;
  creatorAddress: string | null;
  ownerBalance: number | null;
  ownerPercentage: number | null;
  creatorPercentage: number | null;
  top10HolderBalance: number;
  top10HolderPercent: number;
  top10UserBalance: number;
  top10UserPercent: number;
  freezeable: boolean | null;
  freezeAuthority: string | null;
  transferFeeEnable: boolean | null;
  isToken2022: boolean;
  mutableMetadata: boolean;
  nonTransferable: boolean | null;
}

export interface BirdeyeTokenOverview {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  liquidity: number;
  v24hUSD: number;           // 24h volume in USD
  v24hChangePercent: number;
  price: number;             // USD
  priceChange24hPercent: number;
  mc: number;                // market cap
  fdv: number;               // fully diluted value
  trade24h: number;          // num trades
  uniqueWallet24h: number;
  holder: number;            // total holders
}

// ── Helius DAS types ─────────────────────────────────────

export interface HeliusTokenAccount {
  address: string;
  amount: number;
  decimals: number;
  owner: string;
}
