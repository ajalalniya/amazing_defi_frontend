import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Perp, Pool } from '@/api/types'

export const useMarketsStore = defineStore('markets', () => {
  const pools = ref<Pool[]>([])
  const perps = ref<Perp[]>([])
  const version = ref<'all' | 'v3' | 'v4'>('all')
  const query = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filteredPools = computed(() => {
    const q = query.value.trim().toLowerCase()
    return pools.value.filter((p) => {
      if (version.value !== 'all' && p.version !== version.value) return false
      if (!q) return true
      return `${p.token0}/${p.token1}`.toLowerCase().includes(q) || p.token0.toLowerCase().includes(q) || p.token1.toLowerCase().includes(q)
    })
  })

  const stats = computed(() => {
    const list = pools.value
    const tvl = list.reduce((s, p) => s + p.tvl, 0)
    const vol = list.reduce((s, p) => s + p.volume24h, 0)
    const best = list.reduce((a, b) => (b.apr > a.apr ? b : a), list[0])
    return { count: list.length, tvl, vol, best }
  })

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [p, m] = await Promise.all([api.pools('all'), api.perps()])
      pools.value = p.pools
      perps.value = m.perps
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load markets'
    } finally {
      loading.value = false
    }
  }

  function patchPrices(ticks: { id: string; price: number; change24h: number }[]) {
    const map = new Map(ticks.map((t) => [t.id, t]))
    pools.value = pools.value.map((p) => {
      const t = map.get(p.id)
      return t ? { ...p, price: t.price, change24h: t.change24h } : p
    })
    perps.value = perps.value.map((p) => {
      const t = map.get(p.id)
      return t ? { ...p, price: t.price, change24h: t.change24h } : p
    })
  }

  function poolById(id: string) {
    return pools.value.find((p) => p.id === id)
  }
  function perpById(id: string) {
    return perps.value.find((p) => p.id === id)
  }

  const ethMark = computed(() => perps.value.find((p) => p.id === 'ETH-USD')?.price || 0)
  const btcMark = computed(() => perps.value.find((p) => p.id === 'BTC-USD')?.price || 0)

  return { pools, perps, version, query, loading, error, filteredPools, stats, load, patchPrices, poolById, perpById, ethMark, btcMark }
})
