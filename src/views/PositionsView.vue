<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import { useToastStore } from '@/stores/toasts'
import StatCard from '@/components/StatCard.vue'
import SegControl from '@/components/SegControl.vue'
import PositionsTable from '@/components/positions/PositionsTable.vue'
import ExposureTable from '@/components/positions/ExposureTable.vue'
import { cls, fmtPct, fmtSigned, fmtUsd } from '@/lib/format'

const pf = usePortfolioStore()
const toasts = useToastStore()

onMounted(() => pf.load())

const r = computed(() => pf.rollups)
const filter = computed({
  get: () => pf.filter,
  set: (v: string) => { pf.filter = v as typeof pf.filter },
})

async function close(id: string) {
  const pnl = await pf.close(id)
  toasts.push('Position closed', `realised ${fmtSigned(pnl)}`, pnl < 0 ? 'err' : undefined)
}
</script>

<template>
  <div class="view">
    <h1 class="page">Positions</h1>
    <p class="page-sub">Every open position across Uniswap v3, Uniswap v4 and GMX, with live P/L.</p>

    <div v-if="pf.error" class="err-retry card">{{ pf.error }} <button class="btn sm" @click="pf.load()">Retry</button></div>

    <div class="grid split-3" style="margin-bottom:16px">
      <StatCard
        label="Total P/L"
        :value="r ? fmtSigned(r.total) : '—'"
        :sub="r ? fmtPct(r.returnPct, 2) + ' on deployed capital' : '—'"
        :tone="r ? cls(r.total) : 'dim'"
      />
      <StatCard
        label="Capital deployed"
        :value="r ? fmtUsd(r.capitalDeployed) : '—'"
        :sub="`${pf.snapshot?.positions.length || 0} positions`"
      />
      <StatCard
        label="LP P/L"
        :value="r ? fmtSigned(r.lpPnl) : '—'"
        :sub="r ? fmtUsd(r.feesCollected) + ' fees collected' : '—'"
        :tone="r ? cls(r.lpPnl) : ''"
      />
      <StatCard
        label="Perp P/L"
        :value="r ? fmtSigned(r.perpPnl) : '—'"
        :sub="r ? fmtSigned(r.fundingPaid) + ' funding' : '—'"
        :tone="r ? cls(r.perpPnl) : ''"
      />
    </div>

    <div class="card">
      <header>
        <h2>Open positions</h2>
        <div style="flex:1" />
        <SegControl
          v-model="filter"
          :options="[
            { value: 'all', label: 'All' },
            { value: 'v3', label: 'Uniswap v3' },
            { value: 'v4', label: 'Uniswap v4' },
            { value: 'gmx', label: 'GMX' },
          ]"
        />
      </header>
      <PositionsTable :rows="pf.positions" @close="close" />
    </div>

    <div class="card" style="margin-top:16px">
      <header><h2>Net exposure by asset</h2><span class="sub">LP delta plus perp delta</span></header>
      <div class="body"><ExposureTable :rows="pf.exposure" /></div>
    </div>
  </div>
</template>
