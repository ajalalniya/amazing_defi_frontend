<script setup lang="ts">
import { computed } from 'vue'
import type { BacktestResult } from '@/api/types'
import { cls, fmtPct, fmtSigned, fmtUsd } from '@/lib/format'
import { returnBreakdown } from '@/lib/returnBreakdown'

const props = defineProps<{ result: BacktestResult | null; scenarioLbl: string }>()

const extra = computed(() => {
  const r = props.result
  if (!r) return null
  const tir = r.avgTimeInRange != null ? r.avgTimeInRange * 100 : null
  const he = r.hedgeEffectiveness
  const hePct = he != null ? Math.max(-999, Math.min(999, he * 100)) : null
  return { tir, hePct, he }
})

const fin = computed(() => (props.result ? returnBreakdown(props.result) : null))
const att = computed(() => props.result?.attribution ?? null)

// The breakdown shows whole dollars rather than fmtUsd's $59.8K, so a small
// gain or loss on a large position still reads in the totals.
const usd = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
const signed = (v: number) => (v >= 0 ? '+' : '−') + usd(Math.abs(v))
</script>

<template>
  <div class="card">
    <header><h2>Results</h2><span class="sub">{{ scenarioLbl }}</span></header>
    <div class="body">
      <div class="kpi-strip">
        <div><div class="k">Net P/L</div><div class="v" :class="result ? cls(result.netPnl) : ''">{{ result ? fmtSigned(result.netPnl) : '—' }}</div></div>
        <div><div class="k">Return (fees incl.)</div><div class="v" :class="result ? cls(result.returnPct) : ''">{{ result ? fmtPct(result.returnPct, 1) : '—' }}</div></div>
        <div><div class="k">Max drawdown</div><div class="v neg">{{ result ? result.maxDrawdownPct.toFixed(1) + '%' : '—' }}</div></div>
        <div><div class="k">Sharpe</div><div class="v">{{ result ? result.sharpe.toFixed(2) : '—' }}</div></div>
      </div>
      <div v-if="fin" class="final">
        <div class="final-head">
          <div>
            <div class="k">Fund value · excl. fees</div>
            <div class="big mono">{{ usd(fin.fundValue) }}</div>
            <div class="mono sub" :class="cls(fin.returnExFeesPct)">{{ fmtPct(fin.returnExFeesPct, 2) }}</div>
          </div>
          <div>
            <div class="k">Fees collected · separate</div>
            <div class="big mono pos">{{ signed(fin.fees) }}</div>
            <div class="mono sub pos">{{ fmtPct(fin.feesPct, 2) }}</div>
          </div>
          <div>
            <div class="k">Total · fund + fees</div>
            <div class="big mono">{{ usd(fin.finalValue) }}</div>
            <div class="mono sub" :class="cls(fin.returnPct)">{{ fmtPct(fin.returnPct, 2) }}</div>
          </div>
        </div>
        <div class="rows">
          <div class="row"><span>Starting capital</span><b>{{ usd(fin.capital) }}</b></div>
          <div class="row"><span>+ LP price P&amp;L, incl. impermanent loss</span><b :class="cls(fin.lpPrice)">{{ signed(fin.lpPrice) }}</b></div>
          <div v-if="fin.swapCost" class="row"><span>− Rebalancing swap fees</span><b class="neg">{{ signed(-fin.swapCost) }}</b></div>
          <template v-if="fin.hasPerps">
            <div class="row"><span>+ Perp directional P&amp;L</span><b :class="cls(fin.perpMarket)">{{ signed(fin.perpMarket) }}</b></div>
            <div class="row"><span>+ Funding, less perp trading fees</span><b :class="cls(fin.perpCarry)">{{ signed(fin.perpCarry) }}</b></div>
          </template>
          <div class="row total"><span>= Fund value, excl. fees</span><b>{{ usd(fin.fundValue) }}</b></div>
          <div class="row"><span>+ LP fees collected (kept aside, not reinvested)</span><b class="pos">{{ signed(fin.fees) }}</b></div>
          <div class="row total"><span>= Total</span><b>{{ usd(fin.finalValue) }}</b></div>
        </div>
      </div>
      <div v-if="att" class="final">
        <div class="t">Profit = fees − volatility cost − hedging costs</div>
        <div class="final-head">
          <div title="Above 1× the fees out-earned the LP's volatility cost — the condition delta-hedged LPing needs">
            <div class="k">Fees ÷ volatility cost</div>
            <div class="big mono" :class="att.feesToVolCost == null ? '' : att.feesToVolCost >= 1 ? 'pos' : 'neg'">
              {{ att.feesToVolCost == null ? '—' : att.feesToVolCost.toFixed(2) + '×' }}
            </div>
          </div>
          <div title="Annualised, from the pool's hourly closes">
            <div class="k">Realized volatility</div>
            <div class="big mono">{{ att.realizedVolPct.toFixed(1) }}%</div>
          </div>
          <template v-if="att.hedged">
            <div>
              <div class="k">Hedge trades</div>
              <div class="big mono">{{ att.hedgeTrades.toLocaleString('en-US') }}</div>
            </div>
            <div title="The short's lowest equity as a percent of its notional, checked hourly. It is liquidated at 10% of collateral.">
              <div class="k">Lowest margin</div>
              <div class="big mono" :class="att.minMarginPct != null && att.minMarginPct < 25 ? 'neg' : ''">
                {{ att.minMarginPct == null ? '—' : att.minMarginPct.toFixed(1) + '%' }}
              </div>
            </div>
          </template>
        </div>
        <div class="rows">
          <div class="row"><span>+ Fees earned</span><b class="pos">{{ signed(att.fees) }}</b></div>
          <div class="row" title="Every hour, what the LP lost against holding its start-of-hour ETH: its negative gamma. A delta hedge cannot remove this, only the price bet.">
            <span>− Volatility cost <i class="dim">(LP gamma / LVR, measured hourly)</i></span><b class="neg">{{ signed(-att.volatilityCost) }}</b>
          </div>
          <div v-if="att.hedgeCosts" class="row"><span>− Hedge trading costs <i class="dim">(perp fees)</i></span><b class="neg">{{ signed(-att.hedgeCosts) }}</b></div>
          <div v-if="att.rebalanceCosts" class="row"><span>− LP rebalance swap fees</span><b class="neg">{{ signed(-att.rebalanceCosts) }}</b></div>
          <div v-if="att.funding" class="row"><span>± Funding <i class="dim">(catalog rate, constant)</i></span><b :class="cls(att.funding)">{{ signed(att.funding) }}</b></div>
          <div class="row">
            <span>± Residual price P&amp;L <i class="dim">{{ att.hedged ? '(delta left unhedged between re-hedges)' : '(price direction, not hedged)' }}</i></span>
            <b :class="cls(att.residual)">{{ signed(att.residual) }}</b>
          </div>
          <div class="row total"><span>= Net P/L</span><b :class="cls(att.netPnl)">{{ signed(att.netPnl) }}</b></div>
        </div>
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
              <td>
                {{ x.title }} <span v-if="x.liquidated" class="badge bad">liquidated</span>
                <span v-if="x.rebalances" class="badge" :title="`Closed and reopened ${x.rebalances}× · cost ${fmtUsd(x.rebalanceCost || 0)}`">{{ x.rebalances }}× rebalanced</span>
              </td>
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
        <div class="row" v-if="result.rebalances"><span>Rebalances (LP recentred, perps reopened)</span><b>{{ result.rebalances }}×</b></div>
        <div class="row" v-if="result.rebalances"><span>Rebalancing cost (swap + perp fees, in the rows above)</span><b class="neg">{{ fmtSigned(-(result.rebalanceCost || 0)) }}</b></div>
        <div class="row" v-if="extra.tir != null"><span>Avg. time in range</span><b>{{ extra.tir.toFixed(0) }}%</b></div>
        <div class="row"><span>Hedge effectiveness</span><b>{{ extra.he != null && result.impermanentLoss !== 0 ? extra.hePct!.toFixed(0) + '% of IL offset' : '—' }}</b></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.final { margin-top: 14px; border: 1px solid var(--line-soft); border-radius: var(--radius-sm); padding: 14px; }
.final-head { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
.final .k { color: var(--txt-faint); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.final .big { font-size: 22px; font-weight: 600; margin-top: 4px; }
.final .sub { font-size: 13px; margin-top: 3px; }
.final .row i { font-style: normal; }
.final .row.total { border-top: 1px solid var(--line-soft); padding-top: 9px; }
.final .row.total > span { color: var(--txt); font-weight: 600; }
.final .t { font-weight: 600; font-size: 13px; margin-bottom: 12px; }
</style>
