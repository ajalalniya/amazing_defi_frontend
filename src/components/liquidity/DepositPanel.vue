<script setup lang="ts">
import { computed } from 'vue'
import { useLiquidityStore } from '@/stores/liquidity'
import { useWalletStore } from '@/stores/wallet'
import { amounts } from '@/lib/clmath'
import { fmtAmt, fmtPct, fmtUsd, pctDp } from '@/lib/format'

const lq = useLiquidityStore()
const wallet = useWalletStore()

const amt0Str = computed({
  get: () => {
    const v = lq.shown?.amount0
    return v ? Number(v.toPrecision(6)) : ''
  },
  set: (v: string | number) => { lq.amt0 = Number(v) || 0 },
})
const amt1Str = computed({
  get: () => {
    const v = lq.shown?.amount1
    return v && isFinite(v) ? Number(v.toPrecision(6)) : ''
  },
  set: (v: string | number) => {
    const p = lq.pool
    if (!p) return
    const u = amounts(p.price, lq.lower, lq.upper, 1)
    const n = Number(v) || 0
    lq.amt0 = u.a1 > 0 ? n * (u.a0 / u.a1) : 0
  },
})

const submitLabel = computed(() => {
  if (!wallet.connected) return 'Connect wallet to continue'
  return lq.shown?.singleSided ? 'Add single-sided liquidity' : 'Add liquidity'
})

const hint = computed(() => {
  const p = lq.pool
  const s = lq.shown
  if (!p || !s) return 'Deposits are single-sided when the spot price sits outside your chosen range.'
  if (s.singleSided) {
    const tok = p.price < lq.lower ? p.token0 : p.token1
    return `Spot is outside your range — this deposit will be single-sided in ${tok} and earns no fees until price returns.`
  }
  return `Concentrating ${s.widthPct.toFixed(pctDp(s.widthPct))}% wide multiplies fee income ~${s.capitalEfficiency.toFixed(1)}× versus full range, with ~${(s.timeInRange * 100).toFixed(0)}% expected time in range over 30 days.`
})

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <div class="card" v-if="lq.pool && lq.shown">
    <header><h2>Deposit</h2></header>
    <div class="body">
      <label class="fld">
        <div class="lbl"><span>{{ lq.pool.token0 }}</span> <b>bal {{ fmtAmt(wallet.balances[lq.pool.token0] ?? 0) }}</b></div>
        <div class="input-suffix"><input type="number" v-model="amt0Str" placeholder="0.0" /><span>{{ lq.pool.token0 }}</span></div>
      </label>
      <label class="fld">
        <div class="lbl"><span>{{ lq.pool.token1 }}</span> <b>bal {{ fmtAmt(wallet.balances[lq.pool.token1] ?? 0) }}</b></div>
        <div class="input-suffix"><input type="number" v-model="amt1Str" placeholder="0.0" /><span>{{ lq.pool.token1 }}</span></div>
      </label>
      <div class="rows">
        <div class="row"><span>Position value</span><b>{{ fmtUsd(lq.shown.valueUsd) }}</b></div>
        <div class="row"><span>Deposit ratio</span><b>{{ lq.shown.token0Pct.toFixed(0) }}% {{ lq.pool.token0 }} / {{ lq.shown.token1Pct.toFixed(0) }}% {{ lq.pool.token1 }}</b></div>
        <div class="row"><span>Est. fees (30d)</span><b class="pos">{{ fmtUsd(lq.shown.estFees30d) }}</b></div>
        <div class="row"><span>Est. IL at range edge</span><b class="neg">{{ fmtPct(lq.shown.ilAtUpperEdge, 2) }}</b></div>
        <div class="row"><span>Network fee</span><b class="dim">~$0.42</b></div>
      </div>
      <hr class="sep" />
      <div class="note" :class="lq.shown.singleSided ? '' : 'info'">{{ hint }}</div>
      <button class="btn primary wide" style="margin-top:12px" @click="emit('submit')">{{ submitLabel }}</button>
    </div>
  </div>
</template>
