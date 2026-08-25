<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTradeStore } from '@/stores/trade'
import { useMarketsStore } from '@/stores/markets'
import { useWalletStore } from '@/stores/wallet'
import { useToastStore } from '@/stores/toasts'
import { usePortfolioStore } from '@/stores/portfolio'
import { api } from '@/api/client'
import PriceChart from '@/components/trade/PriceChart.vue'
import OrderForm from '@/components/trade/OrderForm.vue'
import { cls, fmtPct, fmtUsd, price$ } from '@/lib/format'

const tr = useTradeStore()
const markets = useMarketsStore()
const wallet = useWalletStore()
const toasts = useToastStore()
const portfolio = usePortfolioStore()
const router = useRouter()

onMounted(() => tr.init())
watch(() => tr.perpId, () => { tr.fetchCandles(); tr.fetchQuote() })
watch(() => [tr.side, tr.collateral, tr.leverage], () => tr.fetchQuote())

const m = computed(() => tr.perp)
const q = computed(() => tr.localQuote)

async function submit() {
  if (!wallet.connected) { wallet.modalOpen = true; return }
  if (!tr.collateral) { toasts.push('Enter collateral', undefined, 'err'); return }
  const p = m.value
  if (!p) return
  await api.openPosition({
    owner: wallet.address,
    kind: tr.side,
    perpId: p.id,
    collateral: tr.collateral,
    leverage: Number(tr.leverage.toFixed(1)),
  })
  toasts.push(`${tr.side === 'long' ? 'Long' : 'Short'} opened`, `${fmtUsd(tr.collateral * tr.leverage)} on ${p.id}`)
  await portfolio.load()
  router.push('/positions')
}
</script>

<template>
  <div class="view">
    <h1 class="page">GMX perpetuals</h1>
    <p class="page-sub">Isolated-margin longs and shorts, settled against the GMX liquidity pool.</p>

    <div v-if="tr.error" class="err-retry card">{{ tr.error }} <button class="btn sm" @click="tr.init()">Retry</button></div>

    <div class="grid split-2" v-else-if="m && q">
      <div class="grid" style="gap:16px">
        <div class="card">
          <header>
            <h2>{{ m.id }}</h2>
            <span class="badge gmx">GMX</span>
            <div class="mono" style="font-size:17px;font-weight:600">{{ price$(m.price) }}</div>
            <div class="mono" style="font-size:13px" :class="cls(m.change24h)">{{ fmtPct(m.change24h) }}</div>
            <div style="flex:1" />
            <select :value="m.id" style="width:auto;height:34px" @change="tr.select(($event.target as HTMLSelectElement).value)">
              <option v-for="o in markets.perps" :key="o.id" :value="o.id">{{ o.id }}</option>
            </select>
          </header>
          <div class="body">
            <PriceChart :candles="tr.candles" :spot="m.price" :liq="q.liq" />
            <div class="kpi-strip" style="margin-top:14px">
              <div><div class="k">Open interest</div><div class="v">{{ fmtUsd(m.openInterest) }}</div></div>
              <div><div class="k">Funding / 8h</div><div class="v" :class="cls(-m.funding8h)">{{ (m.funding8h * 100).toFixed(4) }}%</div></div>
              <div><div class="k">Borrow / h</div><div class="v">{{ (m.borrowHourly * 100).toFixed(4) }}%</div></div>
              <div><div class="k">Ann. volatility</div><div class="v">{{ (m.sigma * 100).toFixed(0) }}%</div></div>
            </div>
          </div>
        </div>
      </div>
      <OrderForm @submit="submit" />
    </div>
  </div>
</template>
