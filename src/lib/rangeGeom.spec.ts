import { describe, expect, it } from 'vitest'
import { hitTest, logP, logY, rangeDomain, shiftBand } from '@/lib/rangeGeom'

describe('RangeChart geometry', () => {
  it('Y(P(y)) round-trips', () => {
    const lo = 100, hi = 400, y0 = 18, y1 = 304
    for (const y of [18, 80, 160, 240, 304]) {
      const p = logP(y, lo, hi, y0, y1)
      expect(logY(p, lo, hi, y0, y1)).toBeCloseTo(y, 8)
    }
  })

  it('hit-tests handles and the band', () => {
    const yLower = 200, yUpper = 80
    expect(hitTest(200, yLower, yUpper)).toBe('lo')
    expect(hitTest(80, yLower, yUpper)).toBe('hi')
    expect(hitTest(140, yLower, yUpper)).toBe('band')
    expect(hitTest(10, yLower, yUpper)).toBe(null)
  })

  it('band-drag preserves log width', () => {
    const lo = 100, hi = 200
    const next = shiftBand(lo, hi, 150, 165)
    expect(Math.log(next.hi / next.lo)).toBeCloseTo(Math.log(hi / lo), 10)
  })

  it('caps domain expansion at 2.2× beyond series extremes', () => {
    const series = [100, 110, 90]
    const d = rangeDomain(series, 100, 100 / 12, 100 * 12)
    const mn = Math.min(100, ...series)
    const mx = Math.max(100, ...series)
    expect(d.hi).toBeLessThanOrEqual(mx * 2.2 * Math.pow((mx * 2.2) / (mn / 2.2), 0.07) + 1e-6)
    expect(d.lo).toBeGreaterThan(0)
  })
})
