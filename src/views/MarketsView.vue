<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMarketsStore } from '@/stores/markets'
import { useLiquidityStore } from '@/stores/liquidity'
import { useTradeStore } from '@/stores/trade'
import StatCard from '@/components/StatCard.vue'
import PairBadge from '@/components/PairBadge.vue'
import VersionBadge from '@/components/VersionBadge.vue'
import SegControl from '@/components/SegControl.vue'
import { cls, feePct, fmtPct, fmtUsd, price$ } from '@/lib/format'
import type { Pool } from '@/api/types'

const markets = useMarketsStore()
const lq = useLiquidityStore()
const tr = useTradeStore()
const router = useRouter()

onMounted(() => { if (!markets.pools.length) markets.load() })

const ver = computed({
  get: () => markets.version,
  set: (v: string) => { markets.version = v as 'all' | 'v3' | 'v4' },
})

const networkSub = computed(() => {
  const names = [...new Set(markets.pools.map((p) => p.network).filter(Boolean))]
  return names.length ? names.join(' · ') : 'no pools loaded'
})

function poolMeta(p: Pool) {
  const bits = [p.network || 'Unknown network']
  if (p.hook) bits.push(p.hook + ' hook')
  else bits.push('Uniswap v3 pool')
  return bits.join(' · ')
}

function networkClass(name: string) {
  return name === 'Simulated' ? 'warn' : 'mute'
}

function addLiq(id: string) {
  lq.selectPool(id)
  router.push('/liquidity')
}
function trade(id: string, side: 'long' | 'short') {
  tr.select(id, side)
  router.push('/trade')
}
</script>

<template>
  <div class="view">
    <h1 class="page">Markets</h1>
    <p class="page-sub">Concentrated liquidity pools on Uniswap v3 &amp; v4, plus GMX perpetual markets.</p>

    <div v-if="markets.error" class="err-retry card">
      {{ markets.error }}
      <div><button class="btn sm" @click="markets.load()">Retry</button></div>
    </div>

    <div class="grid split-3" style="margin-bottom:16px">
      <StatCard v-if="markets.loading" label="Pools tracked" value="…" sub="loading" />
      <template v-else>
        <StatCard label="Pools tracked" :value="String(markets.stats.count)" :sub="networkSub" />
        <StatCard label="Aggregate TVL" :value="fmtUsd(markets.stats.tvl)" sub="of listed pools" />
        <StatCard label="24h Volume" :value="fmtUsd(markets.stats.vol)" sub="fees follow volume" />
        <StatCard
          label="Best fee APR"
          :value="markets.stats.best ? markets.stats.best.apr.toFixed(1) + '%' : '—'"
          :sub="markets.stats.best ? `${markets.stats.best.token0}/${markets.stats.best.token1} · ${markets.stats.best.network} · ${feePct(markets.stats.best.feeBps)}` : '—'"
          tone="pos"
        />
      </template>
    </div>

    <div class="card">
      <header>
        <h2>Liquidity pools</h2>
        <span class="sub">{{ markets.filteredPools.length }} of {{ markets.pools.length }}</span>
        <div class="spacer" style="flex:1" />
        <SegControl
          v-model="ver"
          :options="[{ value: 'all', label: 'All' }, { value: 'v3', label: 'Uniswap v3' }, { value: 'v4', label: 'Uniswap v4' }]"
        />
        <input type="search" v-model="markets.query" placeholder="Search pair or network" />
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pool</th><th>Network</th><th>Version</th><th>Fee tier</th><th class="num">Price</th><th class="num">24h</th>
              <th class="num">TVL</th><th class="num">Volume 24h</th><th class="num">Fee APR</th><th class="num">Vol (ann.)</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="markets.loading"><td colspan="11"><div class="skeleton" style="margin:12px" /></td></tr>
            <tr v-else-if="!markets.filteredPools.length"><td colspan="11" class="empty">No pools match that search.</td></tr>
            <tr v-for="p in markets.filteredPools" :key="p.id">
              <td>
                <PairBadge :a="p.token0" :b="p.token1" :name="`${p.token0}/${p.token1}`" :meta="poolMeta(p)" />
              </td>
              <td><span class="badge" :class="networkClass(p.network)">{{ p.network || '—' }}</span></td>
              <td><VersionBadge :version="p.version" /></td>
              <td class="mono">{{ feePct(p.feeBps) }}</td>
              <td class="num">{{ price$(p.price) }}</td>
              <td class="num" :class="cls(p.change24h)">{{ fmtPct(p.change24h) }}</td>
              <td class="num">{{ fmtUsd(p.tvl) }}</td>
              <td class="num">{{ fmtUsd(p.volume24h) }}</td>
              <td class="num pos">{{ p.apr.toFixed(1) }}%</td>
              <td class="num dim">{{ (p.sigma * 100).toFixed(0) }}%</td>
              <td class="num"><button class="btn sm" @click="addLiq(p.id)">Add liquidity</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <header><h2>GMX perpetual markets</h2><span class="sub">Isolated margin, up to 50×</span></header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Market</th><th class="num">Mark price</th><th class="num">24h</th>
              <th class="num">Open interest</th><th class="num">Funding / 8h</th><th class="num">Max leverage</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in markets.perps" :key="m.id">
              <td><PairBadge :a="m.base" b="USDC" :name="m.id" meta="perpetual" /></td>
              <td class="num">{{ price$(m.price) }}</td>
              <td class="num" :class="cls(m.change24h)">{{ fmtPct(m.change24h) }}</td>
              <td class="num">{{ fmtUsd(m.openInterest) }}</td>
              <td class="num" :class="cls(-m.funding8h)">{{ (m.funding8h * 100).toFixed(4) }}%</td>
              <td class="num dim">{{ m.maxLeverage }}×</td>
              <td class="num">
                <div class="flex" style="justify-content:flex-end">
                  <button class="btn sm" @click="trade(m.id, 'long')">Long</button>
                  <button class="btn sm" @click="trade(m.id, 'short')">Short</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
