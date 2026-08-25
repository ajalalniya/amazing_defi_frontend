<script setup lang="ts">
import { computed } from 'vue'
import { useTradeStore } from '@/stores/trade'
import { useWalletStore } from '@/stores/wallet'
import ChipGroup from '@/components/ChipGroup.vue'
import SegControl from '@/components/SegControl.vue'
import { cls, fmtAmt, fmtNum, fmtPct, fmtSigned, fmtUsd, price$ } from '@/lib/format'

const tr = useTradeStore()
const wallet = useWalletStore()
const emit = defineEmits<{ submit: [] }>()

const q = computed(() => tr.localQuote)
const m = computed(() => tr.perp)

const submitLabel = computed(() => {
  if (!wallet.connected) return 'Connect wallet to continue'
  const p = m.value
  if (!p || !q.value) return 'Open'
  return `${tr.side === 'long' ? 'Long' : 'Short'} ${p.base} ${q.value.leverage.toFixed(1)}×`
})

const warn = computed(() => {
  const p = m.value
  const qq = q.value
  if (!p || !qq) return ''
  if (qq.leverage > 15) return `At ${qq.leverage.toFixed(1)}× a ${(90 / qq.leverage).toFixed(1)}% adverse move liquidates this position.`
  const dir = tr.side === 'long' ? 1 : -1
  const pay = p.funding8h * dir > 0
  return `${tr.side === 'long' ? 'Longs' : 'Shorts'} ${pay ? 'pay' : 'receive'} funding on ${p.id} at present.`
})

const levChips = [
  { value: '2', label: '2×' },
  { value: '5', label: '5×' },
  { value: '10', label: '10×' },
  { value: '20', label: '20×' },
  { value: '50', label: '50×' },
]
const levChip = computed({
  get: () => String(Math.round(tr.leverage)),
  set: (v: string | null) => { if (v) tr.leverage = Number(v) },
})
</script>

<template>
  <div class="card" v-if="m && q" style="align-self:start">
    <header><h2>Order</h2><span class="sub">Isolated margin</span></header>
    <div class="body">
      <SegControl
        v-model="tr.side"
        :lg="true"
        :options="[{ value: 'long', label: 'Long', side: 'long' }, { value: 'short', label: 'Short', side: 'short' }]"
        style="margin-bottom:14px"
      />
      <label class="fld">
        <div class="lbl">Collateral <b>bal {{ fmtNum(wallet.balances.USDC, 2) }} USDC</b></div>
        <div class="input-suffix"><input type="number" v-model.number="tr.collateral" /><span>USDC</span></div>
      </label>
      <div class="lbl" style="display:flex;justify-content:space-between;font-size:12px;color:var(--txt-dim)">
        <span>Leverage</span><b class="mono" style="color:var(--txt)">{{ q.leverage.toFixed(1) }}×</b>
      </div>
      <input type="range" :min="1.1" :max="m.maxLeverage" step="0.1" v-model.number="tr.leverage" />
      <div style="margin-bottom:14px">
        <ChipGroup v-model="levChip" :options="levChips" />
      </div>
      <div class="rows">
        <div class="row"><span>Position size</span><b>{{ fmtUsd(q.sizeUsd) }} · {{ fmtAmt(q.sizeBase) }} {{ m.base }}</b></div>
        <div class="row"><span>Entry price</span><b>{{ price$(q.entry) }}</b></div>
        <div class="row"><span>Liquidation price</span><b class="neg">{{ price$(q.liq) }}  ({{ fmtPct(q.liqDistancePct, 1) }})</b></div>
        <div class="row"><span>Price impact</span><b>{{ q.impactPct.toFixed(3) }}%</b></div>
        <div class="row"><span>Open fee (0.06%)</span><b>{{ fmtUsd(q.openFee) }}</b></div>
        <div class="row"><span>Est. funding / day</span><b :class="cls(q.fundingPerDay)">{{ fmtSigned(q.fundingPerDay) }}</b></div>
      </div>
      <hr class="sep" />
      <div class="note" :class="q.leverage > 15 ? '' : 'info'">{{ warn }}</div>
      <button class="btn wide" :class="tr.side" style="margin-top:12px" @click="emit('submit')">{{ submitLabel }}</button>
    </div>
  </div>
</template>
