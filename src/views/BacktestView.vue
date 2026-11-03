<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBacktestStore, SCENARIOS, isoDay } from '@/stores/backtest'
import { useMarketsStore } from '@/stores/markets'
import { useToastStore } from '@/stores/toasts'
import LegEditor from '@/components/backtest/LegEditor.vue'
import EquityChart from '@/components/backtest/EquityChart.vue'
import ResultsPanel from '@/components/backtest/ResultsPanel.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import SegControl from '@/components/SegControl.vue'
import { cls, fmtPct } from '@/lib/format'

const bt = useBacktestStore()
const { mode } = storeToRefs(bt)
const markets = useMarketsStore()
const toasts = useToastStore()
const legend = ref<{ name: string; color: string; pct: number }[]>([])

onMounted(() => {
  if (!markets.pools.length) markets.load()
  // Mode starts on-chain, so learn the data window before the user picks dates.
  if (!bt.coverageLoaded) bt.loadCoverage()
})

const today = isoDay()

const uncoveredNames = computed(() =>
  bt.uncoveredLegs
    .map((l) => {
      const p = markets.poolById(l.poolId || '')
      return p ? `${p.token0}/${p.token1} ${p.feeBps / 100}%${p.network ? ' on ' + p.network : ''}` : l.poolId
    })
    .join(', '),
)

const covLbl = computed(() => {
  const c = bt.coverage
  if (!c) return ''
  return `${c.pair} · ${c.fullFrom} → ${c.fullTo} (${c.days} days on disk)`
})

const scenarioLbl = computed(() => {
  const r = bt.result
  if (!r) return ''
  if (r.source === 'onchain' || bt.mode === 'onchain') {
    return `On-chain ${bt.from} → ${bt.to}`
  }
  return `${SCENARIOS[bt.scenario]?.label || 'Custom'} · ${r.days}d · drift ${bt.driftPct.toFixed(0)}% · vol ${bt.volPct.toFixed(0)}%`
})

async function run() {
  await bt.run()
  if (bt.error) toasts.push('Nothing to simulate', bt.error, 'err')
  else if (bt.result) {
    const extra = bt.result.source === 'onchain' ? `${bt.from} → ${bt.to}` : `${SCENARIOS[bt.scenario]?.label}`
    toasts.push('Backtest complete', `${bt.legs.length} legs · ${extra}`)
  }
}
</script>

<template>
  <div class="view">
    <h1 class="page">Scenario backtest</h1>
    <p class="page-sub">Compose one or more legs — LP ranges, longs, shorts — and simulate them together over a price path. On-chain mode walks Uniswap v3 swaps for the selected dates and downloads any missing CSV range.</p>

    <div class="grid split-2 rev">
      <div class="grid" style="gap:16px;align-content:start">
        <div class="card">
          <header>
            <h2>Strategy legs</h2>
            <span class="sub">{{ bt.legs.length }} {{ bt.legs.length === 1 ? 'leg' : 'legs' }}</span>
            <div style="flex:1" />
            <button class="btn sm" @click="bt.addLeg('lp')">+ LP range</button>
            <button class="btn sm" @click="bt.addLeg('long')">+ Long</button>
            <button class="btn sm" @click="bt.addLeg('short')">+ Short</button>
          </header>
          <div class="body"><LegEditor /></div>
        </div>
        <div class="card">
          <header>
            <h2>Market scenario</h2>
            <div style="flex:1" />
            <SegControl
              v-model="mode"
              dense
              :options="[{ value: 'onchain', label: 'On-chain' }, { value: 'scenario', label: 'Scenario' }]"
            />
          </header>
          <div class="body">
            <template v-if="bt.mode === 'scenario'">
            <ChipGroup
              style="margin-bottom:14px"
              :model-value="bt.scenario"
              :options="Object.entries(SCENARIOS).map(([k, v]) => ({ value: k, label: v.label }))"
              @update:model-value="v => v && bt.setScenario(v)"
            />
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
              <label class="fld" style="margin:0">
                <div class="lbl">Horizon</div>
                <select v-model.number="bt.days">
                  <option :value="30">30 days</option>
                  <option :value="90">90 days</option>
                  <option :value="180">180 days</option>
                  <option :value="365">365 days</option>
                </select>
              </label>
              <label class="fld" style="margin:0">
                <div class="lbl">Total drift <b class="mono">%</b></div>
                <input type="number" v-model.number="bt.driftPct" step="1" />
              </label>
              <label class="fld" style="margin:0">
                <div class="lbl">Ann. volatility %</div>
                <input type="number" v-model.number="bt.volPct" step="1" />
              </label>
              <label class="fld" style="margin:0">
                <div class="lbl">Path seed</div>
                <input type="number" v-model.number="bt.seed" step="1" />
              </label>
            </div>
            </template>
            <template v-else>
              <p v-if="bt.coverage" class="page-sub" style="margin:0 0 14px">
                Swaps on disk: <b class="mono">{{ covLbl }}</b>. Dates outside this range are fetched from RPC and appended to the local CSV.
              </p>
              <p v-else class="page-sub" style="margin:0 0 14px">ETH/USDC 0.05% on Base. Missing swap days are fetched from RPC and appended to the local CSV.</p>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
                <label class="fld" style="margin:0">
                  <div class="lbl">From</div>
                  <input
                    type="date"
                    :value="bt.from"
                    :max="today"
                    @change="bt.setFrom(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="fld" style="margin:0">
                  <div class="lbl">To</div>
                  <input
                    type="date"
                    :value="bt.to"
                    :max="today"
                    @change="bt.setTo(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="fld" style="margin:0">
                  <div class="lbl">Preset</div>
                  <select :value="bt.days" @change="bt.setHorizon(Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="h in bt.horizons" :key="h.days" :value="h.days">{{ h.label }}</option>
                  </select>
                </label>
              </div>
            </template>
            <p v-if="bt.uncoveredLegs.length" class="page-sub" style="margin:0 0 10px;color:var(--warn,#c90)">
              No swaps on disk for {{ uncoveredNames }} — the whole window will be downloaded over RPC, which can take a very long time.
              Pick a pool marked “data on disk” to use the local CSV.
            </p>
            <p v-else-if="bt.outsideCoverage" class="page-sub" style="margin:0 0 10px;color:var(--warn,#c90)">
              This window reaches past the swaps on disk — the missing days will be downloaded over RPC first.
            </p>
            <button class="btn primary wide" style="margin-top:6px" :disabled="bt.running" @click="run">
              {{ bt.running ? 'Running…' : 'Run backtest' }}
            </button>
            <div
              v-if="bt.running && bt.mode === 'onchain'"
              class="fetch-progress"
              role="progressbar"
              :aria-valuenow="bt.progress.percent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="fetch-progress-head">
                <span>{{ bt.progress.message || 'Working…' }}</span>
                <b class="mono">{{ bt.progress.percent }}%</b>
              </div>
              <div class="fetch-progress-track">
                <div class="fetch-progress-fill" :style="{ width: bt.progress.percent + '%' }" />
              </div>
              <div v-if="bt.progress.detail" class="fetch-progress-detail">{{ bt.progress.detail }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid" style="gap:16px;align-content:start">
        <div class="card">
          <header>
            <h2>Combined equity curve</h2>
            <div style="flex:1" />
            <SegControl
              v-model="bt.chartMode"
              :options="[{ value: 'combined', label: 'Combined' }, { value: 'legs', label: 'Per leg' }]"
            />
          </header>
          <div class="body">
            <EquityChart :result="bt.result" :mode="bt.chartMode" @legend="legend = $event" />
            <div class="range-legend" style="margin-top:10px">
              <span v-for="s in legend" :key="s.name">
                <i :style="{ background: s.color }" />{{ s.name }}
                <b class="mono" :class="cls(s.pct)"> {{ fmtPct(s.pct, 1) }}</b>
              </span>
            </div>
          </div>
        </div>
        <ResultsPanel :result="bt.result" :scenario-lbl="scenarioLbl" />
      </div>
    </div>
  </div>
</template>
