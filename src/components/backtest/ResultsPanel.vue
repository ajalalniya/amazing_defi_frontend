<script setup lang="ts">
import { computed } from 'vue'
import type { BacktestResult } from '@/api/types'
import { cls, fmtPct, fmtSigned, fmtUsd } from '@/lib/format'

const props = defineProps<{ result: BacktestResult | null; scenarioLbl: string }>()

const extra = computed(() => {
  const r = props.result
  if (!r) return null
  const tir = r.avgTimeInRange != null ? r.avgTimeInRange * 100 : null
  const he = r.hedgeEffectiveness
  const hePct = he != null ? Math.max(-999, Math.min(999, he * 100)) : null
  return { tir, hePct, he }
})
</script>

<template>
  <div class="card">
    <header><h2>Results</h2><span class="sub">{{ scenarioLbl }}</span></header>
    <div class="body">
      <div class="kpi-strip">
        <div><div class="k">Net P/L</div><div class="v" :class="result ? cls(result.netPnl) : ''">{{ result ? fmtSigned(result.netPnl) : '—' }}</div></div>
        <div><div class="k">Return</div><div class="v" :class="result ? cls(result.returnPct) : ''">{{ result ? fmtPct(result.returnPct, 1) : '—' }}</div></div>
        <div><div class="k">Max drawdown</div><div class="v neg">{{ result ? result.maxDrawdownPct.toFixed(1) + '%' : '—' }}</div></div>
        <div><div class="k">Sharpe</div><div class="v">{{ result ? result.sharpe.toFixed(2) : '—' }}</div></div>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table>
          <thead>
            <tr>
              <th>Leg</th><th class="num">Capital</th><th class="num">Fees / funding</th>
              <th class="num">Market P&amp;L</th><th class="num">Imp. loss</th><th class="num">Net P/L</th><th class="num">Return</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!result"><td colspan="7" class="empty">Run a backtest to see the breakdown.</td></tr>
            <tr v-for="(x, i) in result?.legs || []" :key="i">
              <td>{{ x.title }} <span v-if="x.liquidated" class="badge bad">liquidated</span></td>
              <td class="num">{{ fmtUsd(x.capital) }}</td>
              <td class="num" :class="cls(x.carry)">{{ fmtSigned(x.carry) }}</td>
              <td class="num" :class="cls(x.market)">{{ fmtSigned(x.market) }}</td>
              <td class="num" :class="x.kind === 'lp' ? cls(x.il) : 'dim'">{{ x.kind === 'lp' ? fmtSigned(x.il) : '—' }}</td>
              <td class="num" :class="cls(x.netPnl)">{{ fmtSigned(x.netPnl) }}</td>
              <td class="num" :class="cls(x.returnPct)">{{ fmtPct(x.returnPct, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="rows" style="margin-top:14px" v-if="result && extra">
        <div class="row"><span>Fees earned by LP legs</span><b class="pos">{{ fmtSigned(result.feesEarned) }}</b></div>
        <div class="row"><span>Impermanent loss</span><b :class="cls(result.impermanentLoss)">{{ fmtSigned(result.impermanentLoss) }}</b></div>
        <div class="row"><span>Funding paid / received</span><b :class="cls(result.funding)">{{ fmtSigned(result.funding) }}</b></div>
        <div class="row"><span>Directional P&amp;L from perps</span><b :class="cls(result.perpMarketPnl)">{{ fmtSigned(result.perpMarketPnl) }}</b></div>
        <div class="row" v-if="extra.tir != null"><span>Avg. time in range</span><b>{{ extra.tir.toFixed(0) }}%</b></div>
        <div class="row"><span>Hedge effectiveness</span><b>{{ extra.he != null && result.impermanentLoss !== 0 ? extra.hePct!.toFixed(0) + '% of IL offset' : '—' }}</b></div>
      </div>
    </div>
  </div>
</template>
