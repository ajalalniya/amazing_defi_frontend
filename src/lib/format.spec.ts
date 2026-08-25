import { describe, expect, it } from 'vitest'
import { fmtPct, fmtPctAuto, pctDp } from '@/lib/format'

describe('percentage decimals', () => {
  it('uses 2dp under 1%', () => {
    expect(pctDp(0.05)).toBe(2)
    expect(fmtPctAuto(0.05)).toBe('+0.05%')
    expect(pctDp(0.44)).toBe(2)
    expect(fmtPctAuto(0.44)).toBe('+0.44%')
  })
  it('uses 1dp under 10%', () => {
    expect(pctDp(4.7)).toBe(1)
    expect(fmtPct(4.7, pctDp(4.7))).toBe('+4.7%')
  })
  it('uses 0dp at 47% and 14300%', () => {
    expect(pctDp(47)).toBe(0)
    expect(fmtPctAuto(47)).toBe('+47%')
    expect(pctDp(14300)).toBe(0)
    expect(fmtPctAuto(14300)).toBe('+14300%')
  })
})
