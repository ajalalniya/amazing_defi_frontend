import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { BacktestLeg, BacktestResult } from '@/api/types'
import { useMarketsStore } from './markets'

export const SCENARIOS: Record<string, { drift: number; vol: number; label: string }> = {
  bull: { drift: 45, vol: 65, label: 'Bull +45%' },
  bear: { drift: -38, vol: 70, label: 'Bear −38%' },
  chop: { drift: 2, vol: 38, label: 'Sideways chop' },
  crash: { drift: -6, vol: 120, label: 'Crash & recover' },
  vol: { drift: 12, vol: 150, label: 'High volatility' },
  custom: { drift: 20, vol: 80, label: 'Custom' },
}

export type UiLeg = BacktestLeg & { id: number }

export const useBacktestStore = defineStore('backtest', () => {
  const markets = useMarketsStore()
  let seq = 3
  const legs = ref<UiLeg[]>([
    { id: 1, kind: 'lp', poolId: 'v4-eth-usdc-005', capital: 50_000, lower: 2850, upper: 3550 },
    { id: 2, kind: 'short', perpId: 'ETH-USD', capital: 10_000, leverage: 3 },
  ])
  const scenario = ref('bull')
  const days = ref(90)
  const driftPct = ref(45)
  const volPct = ref(65)
  const seed = ref(42)
  const chartMode = ref<'combined' | 'legs'>('combined')
  const result = ref<BacktestResult | null>(null)
  const running = ref(false)
  const error = ref<string | null>(null)

  const request = computed(() => ({
    legs: legs.value.map(({ id: _id, ...l }) => l),
    days: days.value,
    driftPct: driftPct.value,
    volPct: volPct.value,
    seed: seed.value,
  }))

  function setScenario(id: string) {
    scenario.value = id
    const s = SCENARIOS[id]
    if (id !== 'custom' && s) {
      driftPct.value = s.drift
      volPct.value = s.vol
    }
  }

  function addLeg(kind: string) {
    if (kind === 'lp') {
      const p = markets.poolById('v4-eth-usdc-005') || markets.pools[0]
      const price = p?.price || 3184
      legs.value.push({ id: seq++, kind: 'lp', poolId: p?.id, capital: 25_000, lower: price * 0.9, upper: price * 1.1 })
    } else {
      legs.value.push({ id: seq++, kind, perpId: 'ETH-USD', capital: 10_000, leverage: 3 })
    }
  }

  function removeLeg(id: number) {
    legs.value = legs.value.filter((l) => l.id !== id)
  }

  function updateLeg(id: number, patch: Partial<UiLeg>) {
    const l = legs.value.find((x) => x.id === id)
    if (!l) return
    Object.assign(l, patch)
    if (patch.poolId) {
      const p = markets.poolById(patch.poolId)
      if (p) {
        l.lower = p.price * 0.9
        l.upper = p.price * 1.1
      }
    }
  }

  async function run() {
    if (!legs.value.length) {
      error.value = 'Add at least one strategy leg.'
      return
    }
    running.value = true
    error.value = null
    try {
      result.value = await api.backtest(request.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Backtest failed'
    } finally {
      running.value = false
    }
  }

  return {
    legs, scenario, days, driftPct, volPct, seed, chartMode, result, running, error, request,
    setScenario, addLeg, removeLeg, updateLeg, run,
  }
})
