<script setup lang="ts">
import type { MarkedPosition } from '@/api/types'
import PairBadge from '@/components/PairBadge.vue'
import VersionBadge from '@/components/VersionBadge.vue'
import { cls, fmtPct, fmtSigned, fmtUsd, price$ } from '@/lib/format'

defineProps<{ rows: MarkedPosition[] }>()
const emit = defineEmits<{ close: [id: string] }>()

function parts(m: string) {
  const [a, b] = m.split(/[/\-]/)
  return { a, b: b || 'USDC' }
}

function detail(p: MarkedPosition) {
  if (p.kind === 'lp') return `${price$(p.lower || 0)} – ${price$(p.upper || 0)}`
  return `${p.leverage}× · liq ${price$(p.liq || 0)}`
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Market</th><th>Platform</th><th>Type</th><th>Detail</th>
          <th class="num">Size</th><th class="num">Entry</th><th class="num">Mark</th>
          <th class="num">Fees / funding</th><th class="num">P/L</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length"><td colspan="10" class="empty">No positions on this platform yet.</td></tr>
        <tr v-for="p in rows" :key="p.id">
          <td>
            <PairBadge :a="parts(p.market).a" :b="parts(p.market).b" :name="p.market" :meta="p.kind === 'lp' ? 'concentrated' : 'perpetual'" />
          </td>
          <td><VersionBadge :version="p.platform" /></td>
          <td>
            <span v-if="p.kind === 'lp'" class="badge" :class="p.inRange ? 'ok' : 'warn'">{{ p.inRange ? 'LP · in range' : 'LP · out of range' }}</span>
            <span v-else class="badge" :class="p.kind === 'long' ? 'ok' : 'bad'">{{ p.kind === 'long' ? 'Long' : 'Short' }}</span>
          </td>
          <td class="mono dim">{{ detail(p) }}</td>
          <td class="num">{{ fmtUsd(p.size) }}</td>
          <td class="num">{{ price$(p.entry) }}</td>
          <td class="num">{{ price$(p.mark) }}</td>
          <td class="num" :class="cls(p.kind === 'lp' ? (p.fees || 0) : (p.funding || 0))">{{ fmtSigned(p.kind === 'lp' ? (p.fees || 0) : (p.funding || 0)) }}</td>
          <td class="num" :class="cls(p.pnl)">{{ fmtSigned(p.pnl) }}<div class="dim" style="font-size:11px">{{ fmtPct(p.returnPct, 1) }}</div></td>
          <td class="num"><button class="btn sm" @click="emit('close', p.id)">Close</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
