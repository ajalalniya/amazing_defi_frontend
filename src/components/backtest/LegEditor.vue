<script setup lang="ts">
import { useBacktestStore, type UiLeg } from '@/stores/backtest'
import { useMarketsStore } from '@/stores/markets'
import VersionBadge from '@/components/VersionBadge.vue'

const bt = useBacktestStore()
const markets = useMarketsStore()

function title(l: UiLeg) {
  if (l.kind === 'lp') {
    const p = markets.poolById(l.poolId || '')
    return p ? `LP · ${p.token0}/${p.token1} ${p.feeBps / 100}% · ${p.version}` : 'LP'
  }
  const m = markets.perpById(l.perpId || '')
  return `${l.kind === 'long' ? 'Long' : 'Short'} · ${m?.id || l.perpId} · GMX`
}
</script>

<template>
  <div v-if="!bt.legs.length" class="empty">Add at least one leg to backtest.</div>
  <div v-for="l in bt.legs" :key="l.id" class="leg">
    <template v-if="l.kind === 'lp'">
      <div class="head">
        <VersionBadge :version="markets.poolById(l.poolId || '')?.version || 'v4'" />
        <span class="t">{{ title(l) }}</span>
        <button class="icon-btn" aria-label="Remove leg" @click="bt.removeLeg(l.id)">×</button>
      </div>
      <div class="fields">
        <label>
          <div class="lbl">Pool</div>
          <select :value="l.poolId" @change="bt.updateLeg(l.id, { poolId: ($event.target as HTMLSelectElement).value })">
            <option v-for="p in markets.pools" :key="p.id" :value="p.id">{{ p.token0 }}/{{ p.token1 }} {{ p.feeBps / 100 }}% {{ p.version }}</option>
          </select>
        </label>
        <label>
          <div class="lbl">Capital $</div>
          <input type="number" :value="l.capital" @change="bt.updateLeg(l.id, { capital: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label>
          <div class="lbl">Min price</div>
          <input type="number" step="any" :value="l.lower" @change="bt.updateLeg(l.id, { lower: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label>
          <div class="lbl">Max price</div>
          <input type="number" step="any" :value="l.upper" @change="bt.updateLeg(l.id, { upper: Number(($event.target as HTMLInputElement).value) })" />
        </label>
      </div>
    </template>
    <template v-else>
      <div class="head">
        <VersionBadge version="gmx" />
        <span class="t" :style="{ color: l.kind === 'long' ? 'var(--long)' : 'var(--short)' }">{{ title(l) }}</span>
        <button class="icon-btn" aria-label="Remove leg" @click="bt.removeLeg(l.id)">×</button>
      </div>
      <div class="fields">
        <label>
          <div class="lbl">Market</div>
          <select :value="l.perpId" @change="bt.updateLeg(l.id, { perpId: ($event.target as HTMLSelectElement).value })">
            <option v-for="p in markets.perps" :key="p.id" :value="p.id">{{ p.id }}</option>
          </select>
        </label>
        <label>
          <div class="lbl">Collateral $</div>
          <input type="number" :value="l.capital" @change="bt.updateLeg(l.id, { capital: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label>
          <div class="lbl">Leverage</div>
          <input type="number" step="0.5" :value="l.leverage" @change="bt.updateLeg(l.id, { leverage: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label>
          <div class="lbl">Direction</div>
          <select :value="l.kind" @change="bt.updateLeg(l.id, { kind: ($event.target as HTMLSelectElement).value })">
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
      </div>
    </template>
  </div>
</template>
