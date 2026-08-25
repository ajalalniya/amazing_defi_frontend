import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '@/api/client'
import type { DepthBin, LPQuote, Pool } from '@/api/types'
import * as cl from '@/lib/clmath'
import { useMarketsStore } from './markets'
import { useWalletStore } from './wallet'

export const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '1y', label: '1Y' },
]

export const PRESETS = [
  { value: '0.005', label: '±0.5%' },
  { value: '0.02', label: '±2%' },
  { value: '0.05', label: '±5%' },
  { value: '0.12', label: '±12%' },
  { value: '0.25', label: '±25%' },
  { value: '0.6', label: '±60%' },
  { value: 'full', label: 'Full range' },
  { value: 'fit', label: 'Fit window' },
]

export const useLiquidityStore = defineStore('liquidity', () => {
  const poolId = ref('v4-eth-usdc-005')
  const lower = ref(0)
  const upper = ref(0)
  const timeframe = ref('90d')
  const preset = ref('0.05')
  const amt0 = ref<number | null>(null)
  const series = ref<number[]>([])
  const depth = ref<DepthBin[]>([])
  const serverQuote = ref<LPQuote | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const dragging = ref(false)

  const markets = useMarketsStore()
  const wallet = useWalletStore()

  const pool = computed<Pool | undefined>(() => markets.poolById(poolId.value) || markets.pools[7] || markets.pools[0])

  const qUsd = computed(() => {
    const p = pool.value
    if (!p) return 1
    return cl.quoteUsd(p.token1, markets.ethMark, markets.btcMark)
  })

  const preview = computed(() => {
    const p = pool.value
    if (!p || !lower.value || !upper.value) return null
    const lo = lower.value
    const hi = upper.value
    const px = p.price
    const unit = cl.amounts(px, lo, hi, 1)
    const q = qUsd.value
    const w0 = unit.a0 * px
    const w1 = unit.a1
    const wt = w0 + w1 || 1
    const a0 = amt0.value === null ? (wallet.balances[p.token0] ?? 1) * 0.25 : amt0.value
    const a1 = unit.a0 > 0 ? a0 * (unit.a1 / unit.a0) : amt0.value === null ? 5000 : 0
    const valueUsd = a0 * px * q + (isFinite(a1) ? a1 : 0) * q
    const eff = cl.concentration(px, lo, hi)
    const tir = cl.timeInRange(px, lo, hi, p.sigma, 30)
    const apr = p.apr * cl.feeMultiplier(px, lo, hi)
    const L = cl.liquidityFor(valueUsd / q, px, lo, hi)
    const il = cl.ilAtUpperEdgePct(px, lo, hi, L)
    const d0 = cl.delta(valueUsd / q, px, lo, hi)
    const held = series.value.length
      ? series.value.filter((v) => v >= lo && v <= hi).length / series.value.length
      : 0
    const outside = px < lo || px > hi
    return {
      amount0: a0,
      amount1: isFinite(a1) ? a1 : 0,
      valueUsd,
      capitalEfficiency: eff,
      feeAprInRange: apr,
      timeInRange: tir,
      widthPct: cl.widthPct(lo, hi),
      estFees30d: valueUsd * (apr / 100) * tir * 30 / 365,
      ilAtUpperEdge: il,
      token0Pct: (w0 / wt) * 100,
      token1Pct: (w1 / wt) * 100,
      deltaToken0: d0,
      deltaUsd: d0 * px * q,
      heldInRange: held,
      singleSided: outside,
    }
  })

  const shown = computed(() => {
    const local = preview.value
    const s = serverQuote.value
    if (!local) return null
    if (!s) return local
    const margin = (a: number, b: number) => Math.abs(a - b) > Math.max(0.02, Math.abs(b) * 0.005)
    return {
      ...local,
      capitalEfficiency: margin(s.capitalEfficiency, local.capitalEfficiency) ? s.capitalEfficiency : local.capitalEfficiency,
      feeAprInRange: margin(s.feeAprInRange, local.feeAprInRange) ? s.feeAprInRange : local.feeAprInRange,
      estFees30d: margin(s.estFees30d, local.estFees30d) ? s.estFees30d : local.estFees30d,
      ilAtUpperEdge: margin(s.ilAtUpperEdge, local.ilAtUpperEdge) ? s.ilAtUpperEdge : local.ilAtUpperEdge,
    }
  })

  function setRangeWidth(w: string | number) {
    const p = pool.value
    if (!p) return
    const px = p.price
    if (w === 'full') {
      lower.value = px / 12
      upper.value = px * 12
      return
    }
    if (w === 'fit') {
      const s = series.value
      if (!s.length) {
        lower.value = px * 0.95
        upper.value = px * 1.05
        return
      }
      const lo = Math.min(...s)
      const hi = Math.max(...s)
      const pad = Math.max((hi - lo) * 0.06, px * 0.0003)
      lower.value = Math.max(px * 1e-4, lo - pad)
      upper.value = hi + pad
      return
    }
    const n = Number(w)
    lower.value = px * (1 - n)
    upper.value = px * (1 + n)
  }

  function selectPool(id: string) {
    poolId.value = id
    amt0.value = null
    preset.value = '0.05'
    setRangeWidth(0.05)
  }

  let quoteTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleQuote() {
    if (quoteTimer) clearTimeout(quoteTimer)
    quoteTimer = setTimeout(fetchQuote, 250)
  }

  async function fetchQuote() {
    const p = pool.value
    const prev = preview.value
    if (!p || !prev) return
    try {
      serverQuote.value = await api.quoteLp({
        poolId: p.id,
        lower: lower.value,
        upper: upper.value,
        amount0: prev.amount0,
        amount1: prev.amount1,
        capitalUsd: prev.valueUsd,
      })
    } catch {
      /* keep local preview */
    }
  }

  async function fetchSeries() {
    const p = pool.value
    if (!p) return
    try {
      const r = await api.poolCandles(p.id, timeframe.value)
      series.value = r.candles.map((c) => c.c)
    } catch {
      /* keep last series — never rescale from live spot */
    }
  }

  async function fetchDepth(lo?: number, hi?: number) {
    const p = pool.value
    if (!p) return
    try {
      const r = await api.depth(p.id, 48, lo, hi)
      depth.value = r.bins
    } catch {
      /* keep last */
    }
  }

  async function init() {
    loading.value = true
    error.value = null
    try {
      if (!markets.pools.length) await markets.load()
      if (!pool.value && markets.pools.length) poolId.value = markets.pools.find((p) => p.id === 'v4-eth-usdc-005')?.id || markets.pools[0].id
      setRangeWidth(preset.value === 'fit' || preset.value === 'full' ? preset.value : Number(preset.value) || 0.05)
      await fetchSeries()
      await fetchDepth()
      await fetchQuote()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load liquidity'
    } finally {
      loading.value = false
    }
  }

  watch(poolId, async () => {
    await fetchSeries()
    await fetchDepth()
    scheduleQuote()
  })
  watch(timeframe, async () => {
    await fetchSeries()
    if (preset.value === 'fit') setRangeWidth('fit')
  })
  watch([lower, upper], () => {
    if (!dragging.value) scheduleQuote()
  })

  return {
    poolId, lower, upper, timeframe, preset, amt0, series, depth, serverQuote,
    loading, error, dragging, pool, preview, shown, qUsd,
    setRangeWidth, selectPool, fetchSeries, fetchDepth, fetchQuote, scheduleQuote, init,
  }
})
