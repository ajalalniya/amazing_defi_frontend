import { describe, expect, it } from 'vitest'
import {
  amounts,
  concentration,
  feeMultiplier,
  ilAtUpperEdgePct,
  liquidityFor,
  timeInRange,
  value,
} from '@/lib/clmath'

describe('clmath (Go golden values)', () => {
  it('Amounts / Value match the token1 identity', () => {
    const p = 100, pa = 90, pb = 110, L = 1
    const { a0, a1 } = amounts(p, pa, pb, L)
    const s = Math.sqrt(p), sa = Math.sqrt(pa), sb = Math.sqrt(pb)
    expect(a0).toBeCloseTo(L * (1 / s - 1 / sb), 12)
    expect(a1).toBeCloseTo(L * (s - sa), 12)
    expect(value(p, pa, pb, L)).toBeCloseTo(a0 * p + a1, 12)
  })

  it('LiquidityFor round-trips to capital', () => {
    const capital = 10_000, p0 = 3184.2, pa = 3024.99, pb = 3343.41
    const L = liquidityFor(capital, p0, pa, pb)
    expect(value(p0, pa, pb, L)).toBeCloseTo(capital, 6)
  })

  it('Concentration of a ±5% band is ≈ 40.5', () => {
    const p = 3184.2
    expect(concentration(p, p * 0.95, p * 1.05)).toBeCloseTo(40.5, 0)
  })

  it('TimeInRange is symmetric around spot and higher for a wider band', () => {
    const p = 100, sigma = 0.62, days = 30
    const tir = timeInRange(p, p * 0.95, p * 1.05, sigma, days)
    expect(tir).toBeGreaterThan(0.01)
    expect(tir).toBeLessThan(1)
    expect(timeInRange(p, p * 0.5, p * 2, sigma, days)).toBeGreaterThan(tir)
    expect(timeInRange(p * 1.08, p * 0.95, p * 1.05, sigma, days)).toBeLessThan(tir)
  })

  it('±5% range moved to its upper edge yields ≈ −1.2% IL', () => {
    const p = 100, pa = 95, pb = 105
    const L = liquidityFor(1, p, pa, pb)
    expect(ilAtUpperEdgePct(p, pa, pb, L)).toBeCloseTo(-1.2, 0)
  })

  it('Fee multiplier is relative to 13.7, not absolute concentration', () => {
    const p = 3184.2
    const m = feeMultiplier(p, p * 0.95, p * 1.05)
    expect(m).toBeCloseTo(40.5 / 13.7, 1)
    expect(m).toBeLessThan(12)
  })
})
