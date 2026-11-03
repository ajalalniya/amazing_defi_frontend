import { describe, expect, it } from 'vitest'
import { autoCollateral } from './autoCollateral'

// The reference LP: $10,000 at 3,000 over 3000/1.1 .. 3300 holds 1.667 ETH
// ($5,000) at the open and 3.415 ETH at the lower edge ($9,312.62 there).
const lp = { capital: 10_000, lower: 3000 / 1.1, upper: 3300, p0: 3000 }

describe('autoCollateral', () => {
  it('sizes a fixed short to the LP delta at the open', () => {
    expect(autoCollateral([lp], false, 1)).toBe(5000)
    expect(autoCollateral([lp], false, 2)).toBe(2500)
  })

  it('sizes a delta hedge for its peak notional at the lower edge', () => {
    expect(autoCollateral([lp], true, 1)).toBe(9313)
    expect(autoCollateral([lp], true, 3)).toBe(3105)
  })

  it('adds up several LP legs', () => {
    expect(autoCollateral([lp, lp], false, 1)).toBe(10_000)
  })

  it('has nothing to size from without a usable LP', () => {
    expect(autoCollateral([], true, 3)).toBeNull()
    expect(autoCollateral([{ ...lp, upper: 2000 }], false, 1)).toBeNull()
    // Opening above the range the LP is all USDC: no ETH to hedge.
    expect(autoCollateral([{ ...lp, p0: 4000 }], false, 1)).toBeNull()
  })
})
