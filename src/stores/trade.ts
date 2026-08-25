import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Candle, Perp, PerpQuote } from '@/api/types'
import { useMarketsStore } from './markets'

export const useTradeStore = defineStore('trade', () => {
  const perpId = ref('ETH-USD')
  const side = ref<'long' | 'short'>('long')
  const collateral = ref(5000)
  const leverage = ref(5)
  const candles = ref<Candle[]>([])
  const serverQuote = ref<PerpQuote | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const markets = useMarketsStore()
  const perp = computed<Perp | undefined>(() => markets.perpById(perpId.value) || markets.perps[0])

  const localQuote = computed(() => {
    const m = perp.value
    if (!m) return null
    const lev = Math.min(Math.max(leverage.value, 1.1), m.maxLeverage)
    const dir = side.value === 'long' ? 1 : -1
    const size = collateral.value * lev
    const liq = m.price * (1 - dir * (0.9 / lev))
    const impact = Math.min(0.9, m.openInterest ? (size / m.openInterest) * 45 : 0)
    const fee = size * 0.0006
    const fundDay = -size * m.funding8h * 3 * dir
    return {
      sizeUsd: size,
      sizeBase: m.price ? size / m.price : 0,
      entry: m.price,
      liq,
      liqDistancePct: m.price ? (liq / m.price - 1) * 100 : 0,
      impactPct: impact,
      openFee: fee,
      fundingPerDay: fundDay,
      leverage: lev,
    }
  })

  function select(id: string, s?: 'long' | 'short') {
    perpId.value = id
    if (s) side.value = s
  }

  function prefillHedge(p: Perp, sizeUsd: number) {
    perpId.value = p.id
    side.value = 'short'
    leverage.value = 3
    collateral.value = Math.max(100, Math.round(sizeUsd / 3))
  }

  async function fetchCandles() {
    const m = perp.value
    if (!m) return
    try {
      const r = await api.perpCandles(m.id, '1d')
      candles.value = r.candles
    } catch {
      /* keep */
    }
  }

  async function fetchQuote() {
    const m = perp.value
    if (!m) return
    try {
      serverQuote.value = await api.quotePerp({
        perpId: m.id,
        side: side.value,
        collateral: collateral.value,
        leverage: leverage.value,
      })
    } catch {
      /* keep local */
    }
  }

  async function init() {
    loading.value = true
    error.value = null
    try {
      if (!markets.perps.length) await markets.load()
      if (!perp.value && markets.perps.length) perpId.value = markets.perps[0].id
      await fetchCandles()
      await fetchQuote()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load trade'
    } finally {
      loading.value = false
    }
  }

  return {
    perpId, side, collateral, leverage, candles, serverQuote, loading, error,
    perp, localQuote, select, prefillHedge, fetchCandles, fetchQuote, init,
  }
})
