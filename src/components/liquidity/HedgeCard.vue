<script setup lang="ts">
import { computed } from 'vue'
import { useLiquidityStore } from '@/stores/liquidity'
import { fmtAmt, fmtUsd } from '@/lib/format'

const lq = useLiquidityStore()
const emit = defineEmits<{ hedge: [] }>()

const delta = computed(() => lq.shown)
const pool = computed(() => lq.pool)
</script>

<template>
  <div class="card" v-if="pool && delta">
    <header><h2>Hedge this position</h2><span class="sub">optional</span></header>
    <div class="body">
      <p class="dim" style="margin:0 0 12px;font-size:12.5px;line-height:1.55">
        A short on GMX offsets the directional exposure an LP picks up as price falls through the range.
        Size it against your position delta.
      </p>
      <div class="rows" style="margin-bottom:12px">
        <div class="row"><span>Position delta</span><b>{{ fmtAmt(delta.deltaToken0) }} {{ pool.token0 }} ({{ fmtUsd(delta.deltaUsd) }})</b></div>
        <div class="row"><span>Suggested short</span><b>{{ fmtAmt(delta.deltaToken0) }} {{ pool.token0 }} short</b></div>
      </div>
      <button class="btn wide" @click="emit('hedge')">Open matching short →</button>
    </div>
  </div>
</template>
