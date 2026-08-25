import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Portfolio } from '@/api/types'
import { useWalletStore } from './wallet'

export const usePortfolioStore = defineStore('portfolio', () => {
  const snapshot = ref<Portfolio | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<'all' | 'v3' | 'v4' | 'gmx'>('all')
  const wallet = useWalletStore()

  const owner = computed(() => wallet.address || 'demo')

  const positions = computed(() => {
    const list = snapshot.value?.positions || []
    if (filter.value === 'all') return list
    return list.filter((p) => p.platform === filter.value)
  })

  const rollups = computed(() => snapshot.value?.rollups)
  const exposure = computed(() => snapshot.value?.exposure || [])

  async function load() {
    loading.value = true
    error.value = null
    try {
      snapshot.value = await api.portfolio(owner.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load portfolio'
    } finally {
      loading.value = false
    }
  }

  function applyRollups(r: Portfolio['rollups']) {
    if (!snapshot.value) return
    snapshot.value = { ...snapshot.value, rollups: r }
  }

  async function close(id: string) {
    const res = await api.closePosition(id, owner.value)
    await load()
    return res.realisedPnl
  }

  return { snapshot, loading, error, filter, owner, positions, rollups, exposure, load, applyRollups, close }
})
