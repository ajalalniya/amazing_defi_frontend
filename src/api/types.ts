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
}

export type BacktestRequest = {
  legs: BacktestLeg[]
  days: number
  driftPct: number
  volPct: number
  seed: number
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
}

export type PriceTick = { id: string; price: number; change24h: number }

export type ApiError = { error: { code: string; message: string } }
