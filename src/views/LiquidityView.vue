<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLiquidityStore, PRESETS, TIMEFRAMES } from '@/stores/liquidity'
import { useMarketsStore } from '@/stores/markets'
import { useWalletStore } from '@/stores/wallet'
import { useToastStore } from '@/stores/toasts'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTradeStore } from '@/stores/trade'
import { api } from '@/api/client'
import RangeChart from '@/components/liquidity/RangeChart.vue'
import RangeStats from '@/components/liquidity/RangeStats.vue'
import DepositPanel from '@/components/liquidity/DepositPanel.vue'
import HedgeCard from '@/components/liquidity/HedgeCard.vue'
import SegControl from '@/components/SegControl.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import VersionBadge from '@/components/VersionBadge.vue'
import { cls, feePct, fmtPct, fmtPctAuto, pctDp, price$ } from '@/lib/format'

const lq = useLiquidityStore()
const markets = useMarketsStore()
const wallet = useWalletStore()
const toasts = useToastStore()
const portfolio = usePortfolioStore()
const trade = useTradeStore()
const router = useRouter()

onMounted(() => lq.init())

const tfOpts = TIMEFRAMES.map((t) => ({ value: t.id, label: t.label }))
const tfLabel = computed(() => TIMEFRAMES.find((t) => t.id === lq.timeframe)?.label || lq.timeframe)
const s = computed(() => lq.shown)
const p = computed(() => lq.pool)

const minStr = computed({
  get: () => (lq.lower ? Number(lq.lower.toPrecision(6)) : ''),
  set: (v: string | number) => {
    const n = Number(v)
    if (n > 0 && n < lq.upper) {
      lq.lower = n
      lq.preset = ''
    }
  },
})
const maxStr = computed({
  get: () => (lq.upper ? Number(lq.upper.toPrecision(6)) : ''),
  set: (v: string | number) => {
    const n = Number(v)
    if (n > lq.lower) {
      lq.upper = n
      lq.preset = ''
    }
  },
})

watch(() => lq.preset, (v) => {
  if (!v) return
  lq.setRangeWidth(v === 'full' || v === 'fit' ? v : Number(v))
})

function onDragStart() { lq.dragging = true }
function onDragEnd() {
  lq.dragging = false
  lq.preset = ''
  lq.scheduleQuote()
  const d = lq.series
  if (d.length) {
    const lo = Math.min(...d, lq.lower, lq.pool?.price || 0)
    const hi = Math.max(...d, lq.upper, lq.pool?.price || 0)
    lq.fetchDepth(lo / 1.1, hi * 1.1)
  }
}

async function submit() {
  if (!wallet.connected) { wallet.modalOpen = true; return }
  const pool = p.value
  const sh = s.value
  if (!pool || !sh || sh.valueUsd <= 0) { toasts.push('Enter a deposit amount', undefined, 'err'); return }
  await api.openPosition({
    owner: wallet.address,
    kind: 'lp',
    poolId: pool.id,
    capital: sh.valueUsd,
    lower: lq.lower,
    upper: lq.upper,
  })
  toasts.push('Liquidity added', `${sh.valueUsd.toFixed(0)} into ${pool.token0}/${pool.token1}`)
  await portfolio.load()
  router.push('/positions')
}

function hedge() {
  const pool = p.value
  const sh = s.value
  if (!pool || !sh) return
  const m = markets.perps.find((x) => x.base === pool.token0) || markets.perps[0]
  if (!m) return
  trade.prefillHedge(m, sh.deltaUsd)
  router.push('/trade')
  toasts.push('Hedge pre-filled', `short on ${m.id} at 3×`)
}

function onPoolSel(e: Event) {
  lq.selectPool((e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="view">
    <h1 class="page">Add concentrated liquidity</h1>
    <p class="page-sub">Pick a pool, set your range against price history and the pool's liquidity depth, then deposit.</p>

    <div v-if="lq.error" class="err-retry card">{{ lq.error }} <button class="btn sm" @click="lq.init()">Retry</button></div>

    <div class="grid split-2" v-else-if="p">
      <div class="grid" style="gap:16px">
        <div class="card">
          <header>
            <h2>{{ p.token0 }}/{{ p.token1 }} · {{ feePct(p.feeBps) }}</h2>
            <VersionBadge :version="p.version" :hook="p.hook" />
            <div style="flex:1" />
            <select :value="p.id" style="width:auto;height:34px" @change="onPoolSel">
              <option v-for="o in markets.pools" :key="o.id" :value="o.id">{{ o.token0 }}/{{ o.token1 }} · {{ o.feeBps / 100 }}% · {{ o.version }}</option>
            </select>
          </header>
          <div class="body" style="padding-bottom:10px">
            <div class="flex wrap" style="justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px">
              <div>
                <div class="dim" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.06em">Current price</div>
                <div class="mono" style="font-size:22px;font-weight:600;margin-top:5px">{{ price$(p.price) }} {{ p.token1 }} per {{ p.token0 }}</div>
                <div class="mono" style="font-size:12px;margin-top:3px" :class="cls(p.change24h)">{{ fmtPct(p.change24h) }} 24h</div>
              </div>
              <div style="display:grid;gap:8px;justify-items:end">
                <SegControl v-model="lq.timeframe" dense :options="tfOpts" />
                <ChipGroup v-model="lq.preset" :options="PRESETS.map(x => ({ value: x.value, label: x.label, title: x.value === 'fit' ? 'Set the bounds to the high and low of the window on screen' : undefined }))" />
              </div>
            </div>
            <RangeChart
              :series="lq.series"
              :depth="lq.depth"
              :spot="p.price"
              :lower="lq.lower"
              :upper="lq.upper"
              :tf-label="tfLabel"
              :pair="p.token0 + '/' + p.token1"
              @update:lower="v => { lq.lower = v; lq.preset = '' }"
              @update:upper="v => { lq.upper = v; lq.preset = '' }"
              @drag-start="onDragStart"
              @drag-end="onDragEnd"
            />
            <div class="range-legend" style="margin-top:8px">
              <span><i style="background:#8f9bc4"></i>Price history</span>
              <span><i style="background:#2b3346"></i>Pool liquidity</span>
              <span><i style="background:rgba(77,227,177,.55)"></i>Your range</span>
              <span><i style="background:#ffc861"></i>Spot price</span>
              <span class="dim">Drag a handle to move one bound, or drag inside the band to shift the whole range.</span>
            </div>
          </div>
        </div>

        <div class="card">
          <header><h2>Price range</h2><span class="sub">{{ p.token1 }} per {{ p.token0 }}</span></header>
          <div class="body">
            <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
              <label class="fld" style="margin:0">
                <div class="lbl">Min price <b>{{ s ? fmtPctAuto((lq.lower / p.price - 1) * 100) : '—' }}</b></div>
                <input type="number" step="any" v-model.number="minStr" />
              </label>
              <label class="fld" style="margin:0">
                <div class="lbl">Max price <b>{{ s ? fmtPctAuto((lq.upper / p.price - 1) * 100) : '—' }}</b></div>
                <input type="number" step="any" v-model.number="maxStr" />
              </label>
            </div>
            <RangeStats
              style="margin-top:14px"
              :efficiency="s ? s.capitalEfficiency.toFixed(1) + '×' : '—'"
              :apr="s ? s.feeAprInRange.toFixed(1) + '%' : '—'"
              :width="s ? s.widthPct.toFixed(pctDp(s.widthPct)) + '%' : '—'"
              :tir="s ? (s.timeInRange * 100).toFixed(0) + '%' : '—'"
              :held="s ? (s.heldInRange * 100).toFixed(0) + '%' : '—'"
              :hist-lbl="tfLabel"
            />
          </div>
        </div>
      </div>

      <div class="grid" style="gap:16px;align-content:start">
        <DepositPanel @submit="submit" />
        <HedgeCard @hedge="hedge" />
      </div>
    </div>
  </div>
</template>
