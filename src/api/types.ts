export type Pool = {
  id: string
  version: string
  token0: string
  token1: string
  feeBps: number
  price: number
  change24h: number
  tvl: number
  volume24h: number
  apr: number
  sigma: number
  network: string
  chainId?: number
  hook?: string
}

export type Perp = {
  id: string
  base: string
  price: number
  change24h: number
  openInterest: number
  funding8h: number
  borrowHourly: number
  maxLeverage: number
  sigma: number
}

export type Position = {
  id: string
  owner: string
  platform: string
  kind: string
  market: string
  poolId?: string
  perpId?: string
  capital?: number
  lower?: number
  upper?: number
  fees?: number
  collateral?: number
  leverage?: number
  funding?: number
  entry: number
  openedAt: string
  txHash?: string
}

export type PositionMetrics = {
  mark: number
  value: number
  il: number
  pnl: number
  size: number
  inRange?: boolean
  liq?: number
  returnPct: number
  hodl?: number
}

export type MarkedPosition = Position & PositionMetrics

export type Rollups = {
  total: number
  capitalDeployed: number
  lpPnl: number
  perpPnl: number
  feesCollected: number
  fundingPaid: number
  returnPct: number
}

export type Exposure = {
  asset: string
  lpDelta: number
  perpDelta: number
  net: number
  bias: string
}

export type Portfolio = {
  positions: MarkedPosition[]
  rollups: Rollups
  exposure: Exposure[]
}

export type DepthBin = { price: number; depth: number }

export type Candle = { t: number; o: number; h: number; l: number; c: number }

export type Timeframe = { id: string; label: string; days: number }

export type LPQuote = {
  poolId: string
  price: number
  lower: number
  upper: number
  widthPct: number
  capitalEfficiency: number
  feeAprInRange: number
  timeInRange: number
  estFees30d: number
  ilAtUpperEdge: number
  depositRatio: { token0Pct: number; token1Pct: number }
  amount0: number
  amount1: number
  valueUsd: number
  deltaToken0: number
  deltaUsd: number
  suggestedHedge: { perpId: string; side: string; sizeUsd: number; leverage: number }
  singleSided: boolean
  warnings: string[]
}

export type PerpQuote = {
  perpId: string
  side: string
  price: number
  collateral: number
  leverage: number
  sizeUsd: number
  sizeBase: number
  entry: number
  liq: number
  liqDistancePct: number
  impactPct: number
  openFee: number
  fundingPerDay: number
  maxLeverage: number
  warnings: string[]
}

export type BacktestLeg = {
  kind: string
  poolId?: string
  perpId?: string
  capital: number
  lower?: number
  upper?: number
  leverage?: number
  // Short only: resize the notional at each daily close to the LP legs'
  // exposure to the same asset. Capital stays the collateral; leverage is ignored.
  hedge?: boolean
  // Hedge only: how often (hours: 1, 2, 3, 4, 6, 8, 12, 24) the hedge is
  // checked against the LP's delta, and the band (percent of LP value) it may
  // drift by before a re-hedge trades. Defaults: 24 and 0.
  hedgeIntervalHours?: number
  hedgeBandPct?: number
  // LP only: when a daily close leaves the range, close and reopen it with the
  // same upper/lower ratio centred on that close; perps on the same asset
  // close and reopen with it.
  rebalance?: boolean
  // With rebalance: recentre only on exits above the range; below it the LP
  // holds its range (all ETH) until price recovers.
  rebalanceSkipBelow?: boolean
}

export type BacktestRequest = {
  legs: BacktestLeg[]
  days: number
  driftPct: number
  volPct: number
  seed: number
  source?: 'scenario' | 'onchain'
  from?: string
  to?: string
}

export type BacktestLegResult = {
  kind: string
  title: string
  capital: number
  carry: number
  market: number
  il: number
  netPnl: number
  returnPct: number
  series: number[]
  liquidated: boolean
  timeInRange?: number
  end: number
  // LP range after snapping to ticks, in the same units as BacktestResult.price.
  lower?: number
  upper?: number
  // A delta-hedge short, and its USD notional held through each day.
  hedged?: boolean
  notional?: number[]
  // Days (indexes into series) the leg was closed and reopened on, and what
  // that cost in USD: pool swap fees for an LP, perp fees for a perp.
  rebalances?: number
  rebalanceDays?: number[]
  rebalanceCost?: number
  // A rebalancing LP's range after each close: entry d is held over day d+1.
  rangeLower?: number[]
  rangeUpper?: number[]
  // An LP leg's cumulative fees in USD at each close, collected to the side
  // (never reinvested): series[d] - fees[d] is the position alone.
  fees?: number[]
  // A hedge's re-hedge count, and a managed perp's lowest equity as a percent
  // of its notional (how close it came to liquidation).
  hedgeTrades?: number
  minMarginPct?: number
}

// profit = fees − volatilityCost − hedgeCosts − rebalanceCosts + funding +
// residual, summing exactly to netPnl. volatilityCost is the LP's convexity
// (gamma / LVR) measured hourly; residual is the directional P/L the hedge
// left between re-hedges (the whole price bet when unhedged).
export type Attribution = {
  fees: number
  volatilityCost: number
  hedgeCosts: number
  rebalanceCosts: number
  funding: number
  residual: number
  netPnl: number
  realizedVolPct: number
  feesToVolCost: number | null
  hedged: boolean
  hedgeTrades: number
  minMarginPct: number | null
}

export type BacktestResult = {
  days: number
  capital: number
  combined: number[]
  legs: BacktestLegResult[]
  netPnl: number
  returnPct: number
  maxDrawdownPct: number
  sharpe: number
  feesEarned: number
  impermanentLoss: number
  funding: number
  perpMarketPnl: number
  avgTimeInRange?: number | null
  hedgeEffectiveness?: number | null
  rebalances?: number
  rebalanceCost?: number
  attribution?: Attribution
  source?: string
  from?: string
  to?: string
  // Daily price of the underlying, one point per entry in `combined`.
  price?: number[]
  priceLabel?: string
}

// HistoryCoverage is the swap data already on disk for one pool.
// from/to are the raw first and last swap days; fullFrom/fullTo trim the
// partial days at each end, and are the dates an on-chain backtest should
// actually use — a window reaching past them triggers an RPC download.
export type HistoryCoverage = {
  poolId: string
  // Every market id bound to this pool address (v3 and v4 alias one pool).
  poolIds: string[]
  pair: string
  chainId: number
  fromTs: number
  toTs: number
  from: string
  to: string
  fullFrom: string
  fullTo: string
  days: number
  bytes: number
}

export type PriceTick = { id: string; price: number; change24h: number }

export type ProviderMode = 'mock' | 'chain'

export type Status = { status: string; provider: ProviderMode }

export type ApiError = { error: { code: string; message: string } }
