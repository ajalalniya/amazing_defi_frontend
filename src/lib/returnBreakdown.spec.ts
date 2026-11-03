import { describe, expect, it } from 'vitest'
import type { BacktestLegResult, BacktestResult } from '@/api/types'
import { returnBreakdown } from './returnBreakdown'

function leg(p: Partial<BacktestLegResult>): BacktestLegResult {
  const l = { kind: 'lp', title: '', capital: 0, carry: 0, market: 0, il: 0, series: [], liquidated: false, end: 0, ...p }
  return { ...l, netPnl: l.carry + l.market + l.il, returnPct: 0 }
}

describe('returnBreakdown', () => {
  it('walks from capital to final value with fees and swap costs split out', () => {
    const legs = [
      leg({ kind: 'lp', capital: 1000, carry: 250.1, market: 11.88, il: -366.31, rebalanceCost: 10.77 }),
      leg({ kind: 'short', capital: 500, carry: -2.1, market: -0.7 }),
    ]
    const netPnl = legs.reduce((s, l) => s + l.netPnl, 0)
    const r = { capital: 1500, netPnl, legs } as unknown as BacktestResult
    const b = returnBreakdown(r)

    expect(b.fees).toBeCloseTo(250.1)
    expect(b.swapCost).toBeCloseTo(10.77)
    expect(b.lpPrice).toBeCloseTo(11.88 - 366.31 + 10.77)
    const steps = b.capital + b.fees + b.lpPrice - b.swapCost + b.perpMarket + b.perpCarry
    expect(steps).toBeCloseTo(b.finalValue, 9)
    expect(b.fundValue + b.fees).toBeCloseTo(b.finalValue, 9)
    expect(b.fundValue).toBeCloseTo(1500 + netPnl - 250.1)
    expect(b.returnPct).toBeCloseTo((netPnl / 1500) * 100)
    expect(b.returnExFeesPct).toBeCloseTo(((netPnl - 250.1) / 1500) * 100)
    expect(b.hasPerps).toBe(true)
  })
})
