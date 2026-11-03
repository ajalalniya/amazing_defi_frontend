import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { HistoryCoverage } from '@/api/types'
import { addDays, clampDay, daysBetween, useBacktestStore, windowForHorizon } from './backtest'
import { useMarketsStore } from './markets'

// The real dump: 2026-01-18 16:32 .. 2026-04-15 09:06 UTC, so the whole days
// it covers are 2026-01-19 .. 2026-04-14.
const COV: HistoryCoverage = {
  poolId: 'v3-eth-usdc-005',
  poolIds: ['v3-eth-usdc-005', 'v4-eth-usdc-005'],
  pair: 'ETH/USDC',
  chainId: 8453,
  fromTs: 1768753965,
  toTs: 1776243967,
  from: '2026-01-18',
  to: '2026-04-15',
  fullFrom: '2026-01-19',
  fullTo: '2026-04-14',
  days: 86,
  bytes: 442072426,
}

vi.mock('@/api/client', () => ({
  api: {
    historyCoverage: vi.fn(async () => ({ coverage: [COV] })),
    backtest: vi.fn(),
    // Closes on disk: 2000 on Feb 1, 2500 on Mar 1; any other day is off the CSV.
    historyPrice: vi.fn(async (poolId: string, date: string) => {
      const price = ({ '2026-02-01': 2000, '2026-03-01': 2500 } as Record<string, number>)[date]
      if (!price) throw new Error('not_found')
      return { poolId, date, price }
    }),
  },
}))

describe('date helpers', () => {
  it('adds and subtracts whole UTC days across month ends', () => {
    expect(addDays('2026-04-14', -1)).toBe('2026-04-13')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-04-14', 0)).toBe('2026-04-14')
  })

  it('counts days between dates', () => {
    expect(daysBetween('2026-01-19', '2026-04-14')).toBe(85)
    expect(daysBetween('2026-01-19', '2026-01-19')).toBe(0)
  })

  it('clamps into range', () => {
    expect(clampDay('2025-12-01', '2026-01-19', '2026-04-14')).toBe('2026-01-19')
    expect(clampDay('2026-10-12', '2026-01-19', '2026-04-14')).toBe('2026-04-14')
    expect(clampDay('2026-02-02', '2026-01-19', '2026-04-14')).toBe('2026-02-02')
  })
})

describe('windowForHorizon', () => {
  it('counts back from the last covered day, not today', () => {
    expect(windowForHorizon(30, COV)).toEqual({ from: '2026-03-16', to: '2026-04-14' })
    expect(daysBetween('2026-03-16', '2026-04-14') + 1).toBe(30)
  })

  it('never reaches past the start of the data', () => {
    expect(windowForHorizon(365, COV)).toEqual({ from: '2026-01-19', to: '2026-04-14' })
  })

  it('spans the full range exactly', () => {
    const w = windowForHorizon(COV.days, COV)
    expect(w).toEqual({ from: '2026-01-19', to: '2026-04-14' })
    expect(daysBetween(w.from, w.to) + 1).toBe(86)
  })
})

describe('backtest store coverage', () => {
  it('opens on one month when the data is shorter than that', async () => {
    const { api } = await import('@/api/client')
    const short = { ...COV, fullFrom: '2026-04-01', days: 14 }
    vi.mocked(api.historyCoverage).mockResolvedValueOnce({ coverage: [short] })
    setActivePinia(createPinia())
    const bt = useBacktestStore()
    await bt.loadCoverage()
    expect(bt.from).toBe('2026-04-01')
    expect(bt.to).toBe('2026-04-14')
    expect(bt.days).toBe(14)
  })

  beforeEach(() => setActivePinia(createPinia()))

  it('moves the default window onto the data on disk', async () => {
    const bt = useBacktestStore()
    // Default is today-90 .. today, which the dump does not cover.
    expect(bt.to).not.toBe(COV.fullTo)

    await bt.loadCoverage()
    expect(bt.coverage?.poolId).toBe('v3-eth-usdc-005')
    // Last month of the data: 30 whole days ending on the last full day.
    expect(bt.from).toBe('2026-03-16')
    expect(bt.to).toBe(COV.fullTo)
    expect(bt.days).toBe(30)
    expect(bt.outsideCoverage).toBe(false)
    expect(bt.request.from).toBe(bt.from)
    expect(bt.request.to).toBe(bt.to)
  })

  it('snaps the window to a pool’s data, whole or its last 30 days', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.setFrom('2025-06-01')
    expect(bt.outsideCoverage).toBe(true)

    bt.useCoverageWindow('v4-eth-usdc-005')
    expect([bt.from, bt.to, bt.days]).toEqual([COV.fullFrom, COV.fullTo, 86])
    expect(bt.outsideCoverage).toBe(false)

    bt.useCoverageWindow('v3-eth-usdc-005', 30)
    expect([bt.from, bt.to, bt.days]).toEqual(['2026-03-16', COV.fullTo, 30])

    // A pool with nothing on disk leaves the window alone.
    bt.useCoverageWindow('v3-eth-usdc-005-arb')
    expect(bt.from).toBe('2026-03-16')
  })

  it('defaults the LP leg to the Base pool that has data on disk', async () => {
    const bt = useBacktestStore()
    expect(bt.legs[0].poolId).toBe('v3-eth-usdc-005')
    await bt.loadCoverage()
    expect(bt.coverage?.poolId).toBe('v3-eth-usdc-005')
    expect(bt.uncoveredLegs).toEqual([])
    expect(bt.outsideCoverage).toBe(false)
  })

  it('still matches a leg that names the v4 alias of the same pool', async () => {
    const bt = useBacktestStore()
    bt.legs[0].poolId = 'v4-eth-usdc-005'
    await bt.loadCoverage()
    expect(bt.poolHasData('v4-eth-usdc-005')).toBe(true)
    expect(bt.uncoveredLegs).toEqual([])
  })

  it('flags an Arbitrum leg: no CSV, so the whole window would download', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.legs[0].poolId = 'v3-eth-usdc-005-arb'
    expect(bt.poolHasData('v3-eth-usdc-005-arb')).toBe(false)
    expect(bt.uncoveredLegs.map((l) => l.poolId)).toEqual(['v3-eth-usdc-005-arb'])
    // Dates are inside the Base CSV, but the run would still download.
    expect(bt.from >= COV.fullFrom && bt.to <= COV.fullTo).toBe(true)
    expect(bt.outsideCoverage).toBe(true)
  })

  it('adds new LP legs on a pool with data on disk, even when it is not listed first', async () => {
    const markets = useMarketsStore()
    markets.pools = [
      { id: 'v3-eth-usdc-005-arb', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 2400, network: 'Arbitrum' },
      { id: 'v3-eth-usdc-005', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 2400, network: 'Base' },
    ] as never
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.addLeg('lp')
    const added = bt.legs[bt.legs.length - 1]
    expect(added.poolId).toBe('v3-eth-usdc-005')
    expect(bt.uncoveredLegs).toEqual([])
  })

  it('gives an LP leg added before the pools load a pool once they arrive', async () => {
    const markets = useMarketsStore()
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.addLeg('lp')
    const added = bt.legs[bt.legs.length - 1]
    expect(added.poolId).toBeUndefined()

    markets.pools = [
      { id: 'v3-eth-usdc-005-arb', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 2000, network: 'Arbitrum' },
      { id: 'v3-eth-usdc-005', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 2000, network: 'Base' },
    ] as never
    await nextTick()
    expect(added.poolId).toBe('v3-eth-usdc-005')
    expect([added.lower, added.upper]).toEqual([1800, 2200])
    // The default leg already named a listed pool and keeps it.
    expect(bt.legs[0].poolId).toBe('v3-eth-usdc-005')
  })

  it('offers only horizons the data can satisfy, plus the full range', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    const days = bt.horizons.map((h) => h.days)
    expect(days).toEqual([30, 86])
    expect(bt.horizons[1].label).toContain('Full range')
  })

  it('allows dates outside the data, such as 2025, and flags them', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    expect(bt.outsideCoverage).toBe(false)

    bt.setFrom('2025-03-01')
    bt.setTo('2025-06-30')
    expect(bt.from).toBe('2025-03-01')
    expect(bt.to).toBe('2025-06-30')
    expect(bt.days).toBe(122)
    expect(bt.outsideCoverage).toBe(true)
    expect(bt.request.from).toBe('2025-03-01')
    expect(bt.request.to).toBe('2025-06-30')
  })

  it('keeps hand-picked dates ordered', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    // A `to` before `from` drags `from` back with it rather than inverting.
    bt.setFrom('2026-03-01')
    bt.setTo('2026-02-01')
    expect(bt.from).toBe('2026-02-01')
    expect(bt.to).toBe('2026-02-01')
    expect(bt.days).toBe(1)
    // An emptied input is ignored rather than blanking the window.
    bt.setFrom('')
    expect(bt.from).toBe('2026-02-01')
  })

  it('keeps days in step with the window', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.setHorizon(30)
    expect(bt.days).toBe(30)
    expect(bt.from).toBe('2026-03-16')
    bt.setFrom('2026-04-10')
    expect(bt.days).toBe(daysBetween('2026-04-10', bt.to) + 1)
  })

  it('leaves the pickers open when no data is on disk', async () => {
    const { api } = await import('@/api/client')
    vi.mocked(api.historyCoverage).mockResolvedValueOnce({ coverage: [] })
    const bt = useBacktestStore()
    await bt.loadCoverage()
    expect(bt.coverage).toBeNull()
    // Nothing on disk, so the LP leg would be downloaded in full: warn.
    expect(bt.uncoveredLegs.length).toBe(1)
    expect(bt.outsideCoverage).toBe(true)
    expect(bt.horizons.map((h) => h.days)).toEqual([30, 90, 180, 365])
  })

  it('survives a failing coverage endpoint', async () => {
    const { api } = await import('@/api/client')
    vi.mocked(api.historyCoverage).mockRejectedValueOnce(new Error('503'))
    const bt = useBacktestStore()
    await bt.loadCoverage()
    expect(bt.coverage).toBeNull()
    expect(bt.coverageLoaded).toBe(true)
  })

  it('does not touch the window in scenario mode', async () => {
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.setMode('scenario')
    bt.setHorizon(180)
    expect(bt.days).toBe(180)
    expect(bt.outsideCoverage).toBe(false)
    expect(bt.request.from).toBeUndefined()
  })

  it('measures LP ranges from the From-day close and re-centres app-picked ranges on it', async () => {
    const markets = useMarketsStore()
    markets.pools = [{ id: 'v3-eth-usdc-005', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 3000, network: 'Base' }] as never
    const bt = useBacktestStore()
    await bt.loadCoverage()
    bt.setFrom('2026-02-01')
    await flush()
    const lp = bt.legs[0]
    expect(bt.refPrice(lp.poolId)).toEqual({ price: 2000, source: 'start', date: '2026-02-01' })
    // The default range was the app's, so it now sits ±10% around the open.
    expect([lp.lower, lp.upper]).toEqual([1800, 2200])

    bt.setRangePct(lp.id, -5, 15)
    expect(lp.lower).toBeCloseTo(1900)
    expect(lp.upper).toBeCloseTo(2300)
    // A range the user set keeps its prices when the reference moves.
    bt.setFrom('2026-03-01')
    await flush()
    expect(bt.refPrice(lp.poolId)?.price).toBe(2500)
    expect(lp.lower).toBeCloseTo(1900)

    // A day off the CSV falls back to the catalog price; so does Scenario.
    bt.setFrom('2026-02-02')
    await flush()
    expect(bt.refPrice(lp.poolId)).toEqual({ price: 3000, source: 'spot' })
    bt.setFrom('2026-02-01')
    bt.setMode('scenario')
    expect(bt.refPrice(lp.poolId)?.source).toBe('spot')
  })

  it('stops treating a range as app-picked once the user edits it', async () => {
    const bt = useBacktestStore()
    const lp = bt.legs[0]
    expect(lp.autoRange).toBe(true)
    bt.updateLeg(lp.id, { lower: 2100 })
    expect(lp.autoRange).toBe(false)
    expect(bt.request.legs[0]).not.toHaveProperty('autoRange')
  })
})

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

describe('auto collateral', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sizes the default short from the LP and sends that collateral', () => {
    const markets = useMarketsStore()
    markets.pools = [{ id: 'v3-eth-usdc-005', version: 'v3', token0: 'ETH', token1: 'USDC', feeBps: 5, price: 3000, network: 'Base' }] as never
    const bt = useBacktestStore()
    bt.setMode('scenario') // reference price = spot 3000
    const lp = bt.legs[0]
    bt.updateLeg(lp.id, { capital: 10_000, lower: 3000 / 1.1, upper: 3300 })
    const short = bt.legs[1]
    expect(short.autoCollateral).toBe(true)

    // Fixed size at 3x: the LP's $5,000 of ETH at the open / 3.
    bt.updateLeg(short.id, { leverage: 3 })
    expect(bt.collateralFor(short)).toBe(1667)
    expect(bt.request.legs[1].capital).toBe(1667)
    expect(bt.request.legs[1]).not.toHaveProperty('autoCollateral')

    // Delta hedge at max 3x: the $9,312.62 peak at the lower edge / 3.
    bt.updateLeg(short.id, { hedge: true })
    expect(bt.request.legs[1].capital).toBe(3105)

    // Manual: the typed value is sent.
    bt.updateLeg(short.id, { autoCollateral: false, capital: 777 })
    expect(bt.request.legs[1].capital).toBe(777)
  })

  it('falls back to the typed collateral with no LP to size from', () => {
    const bt = useBacktestStore()
    bt.removeLeg(bt.legs[0].id)
    expect(bt.autoCollateralOf(bt.legs[0])).toBeNull()
    expect(bt.request.legs[0].capital).toBe(bt.legs[0].capital)
  })

  it('only offers auto collateral to shorts', () => {
    const bt = useBacktestStore()
    bt.addLeg('long')
    const long = bt.legs[bt.legs.length - 1]
    expect(long.autoCollateral).toBe(false)
    expect(bt.autoCollateralOf({ ...long, autoCollateral: true })).toBeNull()
  })
})
