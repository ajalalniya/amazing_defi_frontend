<script setup lang="ts">
import type { Exposure } from '@/api/types'
import { tokenColor } from '@/lib/tokens'
import { cls, fmtSigned } from '@/lib/format'

defineProps<{ rows: Exposure[] }>()

function biasClass(b: string) {
  if (b === 'delta-neutral' || b.includes('neutral')) return 'ok'
  if (b.includes('short')) return 'bad'
  return 'ok'
}
function biasLabel(b: string) {
  if (b === 'delta-neutral' || b.includes('neutral')) return 'delta neutral'
  if (b.includes('short')) return 'net short'
  return 'net long'
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Asset</th><th class="num">LP delta</th><th class="num">Perp delta</th><th class="num">Net delta</th><th>Bias</th></tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length"><td colspan="5" class="empty">No exposure.</td></tr>
        <tr v-for="e in rows" :key="e.asset">
          <td>
            <div class="pair">
              <div class="coins"><div class="coin" :style="{ background: tokenColor(e.asset) }">{{ e.asset.slice(0, 3).toUpperCase() }}</div></div>
              <span class="nm">{{ e.asset }}</span>
            </div>
          </td>
          <td class="num" :class="cls(e.lpDelta)">{{ fmtSigned(e.lpDelta) }}</td>
          <td class="num" :class="cls(e.perpDelta)">{{ fmtSigned(e.perpDelta) }}</td>
          <td class="num" :class="cls(e.net)">{{ fmtSigned(e.net) }}</td>
          <td><span class="badge" :class="biasClass(e.bias)">{{ biasLabel(e.bias) }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
