export const REF_CONCENTRATION = 13.7

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function amounts(p: number, pa: number, pb: number, L = 1): { a0: number; a1: number } {
  if (pa <= 0 || pb <= pa || L === 0) return { a0: 0, a1: 0 }
  const s = Math.sqrt(clamp(p, pa, pb))
  const sa = Math.sqrt(pa)
  const sb = Math.sqrt(pb)
  if (s === 0 || sb === 0) return { a0: 0, a1: 0 }
  return { a0: L * (1 / s - 1 / sb), a1: L * (s - sa) }
}

export function value(p: number, pa: number, pb: number, L: number): number {
  const { a0, a1 } = amounts(p, pa, pb, L)
  return a0 * p + a1
}

export function liquidityFor(capital: number, p0: number, pa: number, pb: number): number {
  const unit = value(p0, pa, pb, 1)
  return unit > 0 ? capital / unit : 0
}

export function concentration(_p: number, pa: number, pb: number): number {
  if (pa <= 0 || pb <= pa) return 1
  const c = 1 / (1 - Math.pow(pa / pb, 0.25))
  return clamp(c, 1, 4000)
}

export function feeMultiplier(p: number, pa: number, pb: number): number {
  return clamp(concentration(p, pa, pb) / REF_CONCENTRATION, 0.05, 12)
}

export function timeInRange(p: number, pa: number, pb: number, sigma: number, days: number): number {
  if (p <= 0 || pa <= 0 || pb <= pa) return 0.01
  let sd = sigma * Math.sqrt(days / 365)
  if (!sd) sd = 1e-6
  const zL = Math.log(pa / p) / sd
  const zU = Math.log(pb / p) / sd
  const cdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))
  return clamp(cdf(zU) - cdf(zL), 0.01, 1)
}

/** Abramowitz & Stegun 7.1.26 — matches the Go service. */
export function erf(x: number): number {
  const s = Math.sign(x)
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x)
  return s * y
}

export function delta(capital: number, p: number, pa: number, pb: number): number {
  const L = liquidityFor(capital, p, pa, pb)
  return amounts(p, pa, pb, L).a0
}

export function widthPct(lower: number, upper: number): number {
  if (lower <= 0) return 0
  return (upper / lower - 1) * 100
}

export function ilAtUpperEdgePct(p: number, pa: number, pb: number, L: number): number {
  const { a0, a1 } = amounts(p, pa, pb, L)
  const atEdge = value(pb, pa, pb, L)
  const hodl = a0 * pb + a1
  return hodl === 0 ? 0 : ((atEdge - hodl) / hodl) * 100
}

export function quoteUsd(token1: string, ethMark: number, btcMark: number): number {
  switch (token1.toUpperCase()) {
    case 'USDC':
    case 'USDT':
    case 'USD':
    case 'DAI':
      return 1
    case 'ETH':
    case 'WETH':
      return ethMark || 1
    case 'WBTC':
    case 'BTC':
      return btcMark || 1
    default:
      return 1
  }
}
