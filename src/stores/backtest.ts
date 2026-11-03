import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '@/api/client'
import type { BacktestLeg, BacktestRequest, BacktestResult, HistoryCoverage } from '@/api/types'
import { useMarketsStore } from './markets'
import { autoCollateral } from '@/lib/autoCollateral'

export const SCENARIOS: Record<string, { drift: number; vol: number; label: string }> = {
  bull: { drift: 45, vol: 65, label: 'Bull +45%' },
  bear: { drift: -38, vol: 70, label: 'Bear −38%' },
  chop: { drift: 2, vol: 38, label: 'Sideways chop' },
  crash: { drift: -6, vol: 120, label: 'Crash & recover' },
  vol: { drift: 12, vol: 150, label: 'High volatility' },
  custom: { drift: 20, vol: 80, label: 'Custom' },
}

export function isoDay(d = new Date(), offsetDays = 0) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() + offsetDays)
  return x.toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  const a = Date.parse(from + 'T00:00:00Z')
  const b = Date.parse(to + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

export function clampDay(iso: string, lo: string, hi: string) {
  if (iso < lo) return lo
  if (iso > hi) return hi
  return iso
}

// windowForHorizon picks the most recent `days` whole days the data actually
// covers, rather than counting back from today — a window reaching past the
// CSV makes the backtest fetch the shortfall over RPC.
export function windowForHorizon(days: number, cov: HistoryCoverage | null) {
  if (!cov) return { from: isoDay(undefined, -days), to: isoDay() }
  const to = cov.fullTo
  const from = clampDay(addDays(to, -(days - 1)), cov.fullFrom, cov.fullTo)
  return { from, to }
}

// The on-chain window opens on the last month of swaps already on disk, so the
// first run needs no RPC download.
export const DEFAULT_ONCHAIN_DAYS = 30

// Base ETH/USDC 0.05%: present in both the mock and live catalogs. The live
// catalog also lists the Arbitrum pool under the same pair and fee, which has
// no swaps on disk.
export const DEFAULT_LP_POOL = 'v3-eth-usdc-005'

// autoRange marks an LP range the app picked (±10% around the reference
// price) rather than the user, so it may be re-centred once the real start
// price is known. autoCollateral sizes a short's collateral from the LP legs
// it hedges (see collateralFor). Both are UI state and never sent.
export type UiLeg = BacktestLeg & { id: number; autoRange?: boolean; autoCollateral?: boolean }

// The reference an LP range's percentages are measured from. 'start' is the
// pool's close on the On-chain From day, the price the backtest opens the LP
// at; 'spot' is the catalog price, which is where a Scenario path starts and
// the fallback while (or when no) start price is on disk.
export type RefPrice = { price: number; source: 'start' | 'spot'; date?: string }

export const DEFAULT_RANGE_PCT = 10

export const useBacktestStore = defineStore('backtest', () => {
  const markets = useMarketsStore()
  let seq = 3
  const legs = ref<UiLeg[]>([
    { id: 1, kind: 'lp', poolId: DEFAULT_LP_POOL, capital: 50_000, lower: 2850, upper: 3550, autoRange: true },
    { id: 2, kind: 'short', perpId: 'ETH-USD', capital: 10_000, leverage: 3, autoCollateral: true },
  ])
  const mode = ref<'scenario' | 'onchain'>('onchain')
  const scenario = ref('bull')
  const days = ref(90)
  const driftPct = ref(45)
  const volPct = ref(65)
  const seed = ref(42)
  // Placeholders only: loadCoverage replaces these with the window the swap
  // CSV actually covers.
  const from = ref(isoDay(undefined, -90))
  const to = ref(isoDay())
  const coverage = ref<HistoryCoverage | null>(null)
  const allCoverage = ref<HistoryCoverage[]>([])
  const coverageLoaded = ref(false)
  const chartMode = ref<'combined' | 'legs'>('combined')
  const result = ref<BacktestResult | null>(null)
  const running = ref(false)
  const error = ref<string | null>(null)
  const progress = ref({ percent: 0, message: '', detail: '' })

  const request = computed<BacktestRequest>(() => {
    const body: BacktestRequest = {
      legs: legs.value.map((l) => {
        const { id: _id, autoRange: _r, autoCollateral: _c, ...leg } = l
        return { ...leg, capital: collateralFor(l) }
      }),
      days: days.value,
      driftPct: driftPct.value,
      volPct: volPct.value,
      seed: seed.value,
      source: mode.value,
    }
    if (mode.value === 'onchain') {
      body.from = from.value
      body.to = to.value
    }
    return body
  })

  // Horizons the data can satisfy, plus its full span. Without coverage every
  // preset is offered and the backtest fetches whatever it needs.
  const horizons = computed(() => {
    const cov = coverage.value
    const base = [30, 90, 180, 365]
    if (!cov) return base.map((d) => ({ days: d, label: `Last ${d} days` }))
    const out = base.filter((d) => d < cov.days).map((d) => ({ days: d, label: `Last ${d} days` }))
    out.push({ days: cov.days, label: `Full range · ${cov.days} days` })
    return out
  })

  function coverageFor(poolId?: string) {
    if (!poolId) return null
    return allCoverage.value.find((c) => (c.poolIds || [c.poolId]).includes(poolId)) || null
  }

  function poolHasData(poolId?: string) {
    return coverageFor(poolId) != null
  }

  // LP legs whose pool has no swaps on disk at all: running them downloads
  // the whole window over RPC, which for a month of Arbitrum is ~10M blocks.
  const uncoveredLegs = computed(() => {
    if (mode.value !== 'onchain' || !coverageLoaded.value) return []
    return legs.value.filter((l) => l.kind === 'lp' && !poolHasData(l.poolId))
  })

  // True when running would download anything: a leg's pool has no CSV, or the
  // window reaches outside the CSV it has.
  const outsideCoverage = computed(() => {
    if (mode.value !== 'onchain') return false
    if (uncoveredLegs.value.length) return true
    const cov = coverage.value
    if (!cov) return false
    return from.value < cov.fullFrom || to.value > cov.fullTo
  })

  function pickCoverage(all: HistoryCoverage[]): HistoryCoverage | null {
    if (!all.length) return null
    const ids = new Set(legs.value.filter((l) => l.kind === 'lp').map((l) => l.poolId))
    // Prefer a pool one of the legs actually uses, matching any of its market
    // ids, else fall back to the widest span available.
    const mine = all.filter((c) => (c.poolIds || [c.poolId]).some((id) => ids.has(id)))
    const pool = (mine.length ? mine : all).slice()
    pool.sort((a, b) => b.days - a.days)
    return pool[0]
  }

  async function loadCoverage() {
    try {
      const { coverage: all } = await api.historyCoverage()
      allCoverage.value = all || []
      const best = pickCoverage(all || [])
      coverage.value = best
      if (best) {
        const w = windowForHorizon(Math.min(DEFAULT_ONCHAIN_DAYS, best.days), best)
        from.value = w.from
        to.value = w.to
        days.value = daysBetween(w.from, w.to) + 1
      }
    } catch {
      // No endpoint or nothing on disk: leave the pickers open and let the
      // backtest fetch whatever the window needs.
      coverage.value = null
      allCoverage.value = []
    } finally {
      coverageLoaded.value = true
    }
  }

  function setMode(next: 'scenario' | 'onchain') {
    mode.value = next
    if (next === 'onchain' && !coverageLoaded.value) void loadCoverage()
  }

  function setHorizon(n: number) {
    if (mode.value === 'onchain') {
      const w = windowForHorizon(n, coverage.value)
      from.value = w.from
      to.value = w.to
      days.value = daysBetween(w.from, w.to) + 1
      return
    }
    days.value = n
    to.value = isoDay()
    from.value = isoDay(undefined, -n)
  }

  // Any date is allowed — coverage only sets the default. Dates outside it
  // are downloaded over RPC, and outsideCoverage warns about that. Just keep
  // the window in order.
  function setFrom(v: string) {
    if (!v) return
    from.value = v
    if (from.value > to.value) to.value = from.value
    days.value = daysBetween(from.value, to.value) + 1
  }

  function setTo(v: string) {
    if (!v) return
    to.value = v
    if (to.value < from.value) from.value = to.value
    days.value = daysBetween(from.value, to.value) + 1
  }

  // useCoverageWindow points the date pickers at everything a pool has on
  // disk (or its last `days` days), so the run needs no RPC download.
  function useCoverageWindow(poolId?: string, lastDays?: number) {
    const cov = coverageFor(poolId)
    if (!cov) return
    coverage.value = cov
    const w = windowForHorizon(lastDays ?? cov.days, cov)
    from.value = w.from
    to.value = w.to
    days.value = daysBetween(w.from, w.to) + 1
  }

  function setScenario(id: string) {
    scenario.value = id
    const s = SCENARIOS[id]
    if (id !== 'custom' && s) {
      driftPct.value = s.drift
      volPct.value = s.vol
    }
  }

  // Start prices by `${poolId}@${date}`; null while loading or when the day
  // is not on disk, either way falling back to spot.
  const startPrices = ref<Record<string, number | null>>({})

  function refPrice(poolId?: string): RefPrice | null {
    if (!poolId) return null
    if (mode.value === 'onchain') {
      const v = startPrices.value[`${poolId}@${from.value}`]
      if (v) return { price: v, source: 'start', date: from.value }
    }
    const p = markets.poolById(poolId)
    return p?.price ? { price: p.price, source: 'spot' } : null
  }

  async function loadStartPrice(poolId: string, date: string) {
    const k = `${poolId}@${date}`
    if (k in startPrices.value) return
    startPrices.value[k] = null
    try {
      const r = await api.historyPrice(poolId, date)
      startPrices.value[k] = r.price
    } catch {
      // Not on disk: the leg keeps measuring from spot.
    }
  }

  function centreRange(l: UiLeg) {
    const ref = refPrice(l.poolId)
    if (!ref) return
    l.lower = ref.price * (1 - DEFAULT_RANGE_PCT / 100)
    l.upper = ref.price * (1 + DEFAULT_RANGE_PCT / 100)
  }

  // On-chain, fetch each LP pool's close on the From day, then re-centre the
  // ranges the app picked so they start around the price the LP opens at.
  watch(
    () => [mode.value, from.value, coverageLoaded.value, legs.value.map((l) => (l.kind === 'lp' ? l.poolId : '')).join()],
    async () => {
      if (mode.value !== 'onchain') return
      const date = from.value
      const ids = [...new Set(legs.value.filter((l) => l.kind === 'lp' && l.poolId && poolHasData(l.poolId)).map((l) => l.poolId!))]
      await Promise.all(ids.map((id) => loadStartPrice(id, date)))
      for (const l of legs.value) if (l.kind === 'lp' && l.autoRange) centreRange(l)
    },
    { immediate: true },
  )

  // autoCollateralOf is what auto sizing gives a short leg: from the LP legs
  // on the perp's asset, at the price they open at. null when there is none.
  function autoCollateralOf(l: UiLeg): number | null {
    if (l.kind !== 'short') return null
    const base = markets.perpById(l.perpId || '')?.base || 'ETH'
    const lps = legs.value
      .filter((x) => x.kind === 'lp' && markets.poolById(x.poolId || '')?.token0 === base)
      .map((x) => ({ capital: x.capital, lower: x.lower || 0, upper: x.upper || 0, p0: refPrice(x.poolId)?.price || 0 }))
    return autoCollateral(lps, !!l.hedge, l.leverage || 1)
  }

  // collateralFor is the collateral a leg runs with: the auto size when it is
  // on and an LP exists to size from, otherwise what was typed.
  function collateralFor(l: UiLeg): number {
    if (!l.autoCollateral) return l.capital
    return autoCollateralOf(l) ?? l.capital
  }

  // setRangePct sets an LP leg's edges as percent from its reference price.
  function setRangePct(id: number, lowPct: number, highPct: number) {
    const l = legs.value.find((x) => x.id === id)
    const ref = refPrice(l?.poolId)
    if (!l || !ref) return
    l.lower = ref.price * (1 + lowPct / 100)
    l.upper = ref.price * (1 + highPct / 100)
    l.autoRange = false
  }

  // Prefer a pool with swaps on disk, so a new leg never starts a download.
  function defaultPool() {
    return markets.pools.find((x) => poolHasData(x.id)) || markets.poolById(DEFAULT_LP_POOL) || markets.pools[0]
  }

  function addLeg(kind: string) {
    if (kind === 'lp') {
      const p = defaultPool()
      const price = refPrice(p?.id)?.price || p?.price || 3184
      legs.value.push({
        id: seq++, kind: 'lp', poolId: p?.id, capital: 25_000, autoRange: true,
        lower: price * (1 - DEFAULT_RANGE_PCT / 100), upper: price * (1 + DEFAULT_RANGE_PCT / 100),
      })
    } else {
      legs.value.push({ id: seq++, kind, perpId: 'ETH-USD', capital: 10_000, leverage: 3, autoCollateral: kind === 'short' })
    }
  }

  // An LP leg added before the catalog arrived (or naming a pool this catalog
  // lacks) has no pool to show: the editor's selects would be empty and stuck.
  // Once pools are in, give it the pool addLeg would pick, ranged around it.
  watch(
    () => markets.pools,
    () => {
      for (const l of legs.value) {
        if (l.kind !== 'lp' || markets.poolById(l.poolId || '')) continue
        const p = defaultPool()
        if (!p) return
        l.poolId = p.id
        l.autoRange = true
        centreRange(l)
      }
    },
  )

  function removeLeg(id: number) {
    legs.value = legs.value.filter((l) => l.id !== id)
  }

  function updateLeg(id: number, patch: Partial<UiLeg>) {
    const l = legs.value.find((x) => x.id === id)
    if (!l) return
    Object.assign(l, patch)
    if ('lower' in patch || 'upper' in patch) l.autoRange = false
    // Keep the on-disk window shown under Market scenario in step with the
    // pools the legs use; the chosen dates are left alone.
    if (patch.poolId && allCoverage.value.length) coverage.value = pickCoverage(allCoverage.value)
    if (patch.poolId) {
      l.autoRange = true
      centreRange(l)
    }
  }

  async function run() {
    if (!legs.value.length) {
      error.value = 'Add at least one strategy leg.'
      return
    }
    if (mode.value === 'onchain' && !coverageLoaded.value) await loadCoverage()
    running.value = true
    error.value = null
    progress.value = { percent: 0, message: mode.value === 'onchain' ? 'Preparing on-chain window…' : '', detail: '' }
    try {
      result.value = await api.backtest(request.value, (p) => {
        progress.value = {
          percent: Math.max(0, Math.min(100, p.percent || 0)),
          message: p.message || '',
          detail: p.detail || '',
        }
      })
      if (mode.value === 'onchain') {
        progress.value = { percent: 100, message: 'Done', detail: '' }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Backtest failed'
    } finally {
      running.value = false
    }
  }

  return {
    legs, mode, scenario, days, driftPct, volPct, seed, from, to, chartMode, result, running, error, progress, request,
    coverage, allCoverage, coverageLoaded, horizons, outsideCoverage, uncoveredLegs, poolHasData, coverageFor, refPrice, setRangePct, autoCollateralOf, collateralFor,
    setMode, setHorizon, setScenario, addLeg, removeLeg, updateLeg, run, loadCoverage, setFrom, setTo, useCoverageWindow,
  }
})
