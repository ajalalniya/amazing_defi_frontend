<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useBacktestStore, SCENARIOS } from '@/stores/backtest'
import { useMarketsStore } from '@/stores/markets'
import { useToastStore } from '@/stores/toasts'
import LegEditor from '@/components/backtest/LegEditor.vue'
import EquityChart from '@/components/backtest/EquityChart.vue'
import ResultsPanel from '@/components/backtest/ResultsPanel.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import SegControl from '@/components/SegControl.vue'
import { cls, fmtPct } from '@/lib/format'

const bt = useBacktestStore()
const markets = useMarketsStore()
const toasts = useToastStore()
const legend = ref<{ name: string; color: string; pct: number }[]>([])

onMounted(() => { if (!markets.pools.length) markets.load() })

const scenarioLbl = computed(() => {
  const r = bt.result
  if (!r) return ''
  return `${SCENARIOS[bt.scenario]?.label || 'Custom'} · ${r.days}d · drift ${bt.driftPct.toFixed(0)}% · vol ${bt.volPct.toFixed(0)}%`
})

async function run() {
  await bt.run()
  if (bt.error) toasts.push('Nothing to simulate', bt.error, 'err')
  else if (bt.result) toasts.push('Backtest complete', `${bt.legs.length} legs · ${bt.days} days · ${SCENARIOS[bt.scenario]?.label}`)
}
</script>

<template>
  <div class="view">
    <h1 class="page">Scenario backtest</h1>
    <p class="page-sub">Compose one or more legs — LP ranges, longs, shorts — and simulate them together over a price path.</p>

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
          <header><h2>Market scenario</h2></header>
          <div class="body">
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
            <button class="btn primary wide" style="margin-top:6px" :disabled="bt.running" @click="run">
              {{ bt.running ? 'Running…' : 'Run backtest' }}
            </button>
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
