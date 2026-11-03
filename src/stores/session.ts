import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { ProviderMode } from '@/api/types'

export const useSessionStore = defineStore('session', () => {
  const provider = ref<ProviderMode | null>(null)
  const error = ref<string | null>(null)

  const label = computed(() => {
    if (provider.value === 'chain') return 'LIVE'
    if (provider.value === 'mock') return 'MOCK'
    return 'API'
  })

  const hint = computed(() => {
    if (provider.value === 'chain') {
      return 'On-chain spots from Uniswap v3 (Base ETH/USDC). Connect MetaMask, Rabby, or Coinbase to use your account.'
    }
    if (provider.value === 'mock') {
      return 'Simulated markets and demo positions. Wallet connect uses your real browser wallet.'
    }
    return 'Cannot reach the API. Start the backend, then refresh.'
  })

  async function load() {
    error.value = null
    try {
      const s = await api.status()
      provider.value = s.provider
    } catch (e) {
      provider.value = null
      error.value = e instanceof Error ? e.message : 'status failed'
    }
  }

  return { provider, error, label, hint, load }
})
