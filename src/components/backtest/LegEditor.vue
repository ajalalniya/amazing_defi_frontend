<script setup lang="ts">
import { useBacktestStore, type UiLeg } from '@/stores/backtest'
import { useMarketsStore } from '@/stores/markets'
import VersionBadge from '@/components/VersionBadge.vue'
import RangeSlider from '@/components/backtest/RangeSlider.vue'
import type { Pool } from '@/api/types'
import { pairOf, pickPool, poolPairs, poolTiers, poolVersions } from '@/lib/poolPicker'

const bt = useBacktestStore()
const markets = useMarketsStore()

function title(l: UiLeg) {
  if (l.kind === 'lp') {
    const p = markets.poolById(l.poolId || '')
    return p ? `LP · ${p.token0}/${p.token1} ${p.feeBps / 100}% · ${p.version}${p.network ? ' · ' + p.network : ''}` : 'LP'
  }
  const m = markets.perpById(l.perpId || '')
  const side = l.kind === 'long' ? 'Long' : l.hedge ? 'Hedge' : 'Short'
  return `${side} · ${m?.id || l.perpId} · GMX`
}

function dataTag(p: Pool) {
  if (!bt.coverageLoaded || bt.mode !== 'onchain') return ''
  const c = bt.coverageFor(p.id)
  return c ? ` · data ${c.fullFrom} → ${c.fullTo}` : ' · no data'
}

// True when the chosen window already sits inside this pool's data.
function windowInside(poolId?: string) {
  const c = bt.coverageFor(poolId)
  return !!c && bt.from >= c.fullFrom && bt.to <= c.fullTo
}

function tierLabel(p: Pool) {
  return `${p.feeBps / 100}%${p.hook ? ' · ' + p.hook : ''}${p.network ? ' · ' + p.network : ''}${dataTag(p)}`
}

// Range edges as percent from the leg's reference price (see bt.refPrice).
function pctOf(l: UiLeg, v?: number) {
  const ref = bt.refPrice(l.poolId)
  if (!ref || !v) return null
  return Math.round((v / ref.price - 1) * 10_000) / 100
}

function setPct(l: UiLeg, edge: 'lo' | 'hi', raw: string) {
  const v = Number(raw)
  const lo = pctOf(l, l.lower), hi = pctOf(l, l.upper)
  if (!Number.isFinite(v) || lo == null || hi == null) return
  if (edge === 'lo') bt.setRangePct(l.id, Math.max(-99, v), hi)
  else bt.setRangePct(l.id, lo, v)
}

// The slider spans ±50% of the reference, widened in steps of 10 to keep both
// edges on the track; prices cannot go below zero, so neither can the low end.
function sliderSpan(l: UiLeg) {
  const far = Math.max(Math.abs(pctOf(l, l.lower) ?? 0), Math.abs(pctOf(l, l.upper) ?? 0))
  const span = Math.max(50, Math.ceil((far + 5) / 10) * 10)
  return { min: Math.max(-95, -span), max: span }
}

function refLabel(l: UiLeg) {
  const ref = bt.refPrice(l.poolId)
  if (!ref) return ''
  const px = ref.price.toLocaleString('en-US', { maximumFractionDigits: ref.price >= 100 ? 2 : 6 })
  return ref.source === 'start' ? `0% = ${px} · close on ${ref.date}, where the backtest opens` : `0% = ${px} · current price`
}

const round2 = (v?: number) => (v == null ? v : Math.round(v * 100) / 100)

function setExitRule(l: UiLeg, v: string) {
  bt.updateLeg(l.id, { rebalance: v !== 'hold', rebalanceSkipBelow: v === 'recentre_up' })
}

// What auto collateral does for this leg, for its tooltip.
function collateralHelp(l: UiLeg) {
  if (l.kind !== 'short') return ''
  if (bt.autoCollateralOf(l) == null) return 'Auto needs an LP leg on this asset to size from'
  return l.hedge
    ? "Auto: enough for the hedge's largest size — the LP all in ETH at its lower edge — at the max leverage"
    : "Auto: the LP's ETH exposure when it opens, divided by the leverage, so the short starts delta-neutral"
}

function choose(l: UiLeg, version: string, pair?: string) {
  const cur = markets.poolById(l.poolId || '')
  const next = pickPool(markets.pools, cur, version, pair, (p) => bt.poolHasData(p.id))
  if (next && next.id !== l.poolId) bt.updateLeg(l.id, { poolId: next.id })
}
</script>

<template>
  <div v-if="!bt.legs.length" class="empty">Add at least one leg to backtest.</div>
  <div v-for="l in bt.legs" :key="l.id" class="leg">
    <template v-if="l.kind === 'lp'">
      <div class="head">
        <VersionBadge v-if="markets.poolById(l.poolId || '')" :version="markets.poolById(l.poolId || '')!.version" />
        <span v-else class="badge">{{ markets.loading || !markets.pools.length ? 'Loading pools…' : 'Pick a pool' }}</span>
        <span class="t">{{ title(l) }}</span>
        <button class="icon-btn" aria-label="Remove leg" @click="bt.removeLeg(l.id)">×</button>
      </div>
      <div class="fields">
        <template v-for="cur in [markets.poolById(l.poolId || '')]" :key="l.id">
          <label>
            <div class="lbl">Version</div>
            <select :value="cur?.version ?? ''" @change="choose(l, ($event.target as HTMLSelectElement).value)">
              <option v-if="!cur" value="" disabled>Select…</option>
              <option v-for="v in poolVersions(markets.pools)" :key="v" :value="v">Uniswap {{ v }}</option>
            </select>
          </label>
          <label>
            <div class="lbl">Pair</div>
            <select :value="cur ? pairOf(cur) : ''" :disabled="!cur" @change="choose(l, cur?.version || '', ($event.target as HTMLSelectElement).value)">
              <option v-if="!cur" value="" disabled>Select a version</option>
              <option v-for="pr in poolPairs(markets.pools, cur?.version || '')" :key="pr" :value="pr">{{ pr }}</option>
            </select>
          </label>
          <label>
            <div class="lbl">Fee tier</div>
            <select :value="cur ? l.poolId : ''" :disabled="!cur" @change="bt.updateLeg(l.id, { poolId: ($event.target as HTMLSelectElement).value })">
              <option v-if="!cur" value="" disabled>—</option>
              <option v-for="p in poolTiers(markets.pools, cur?.version || '', cur ? pairOf(cur) : '')" :key="p.id" :value="p.id">{{ tierLabel(p) }}</option>
            </select>
          </label>
        </template>
        <label>
          <div class="lbl">Capital $</div>
          <input type="number" :value="l.capital" @change="bt.updateLeg(l.id, { capital: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <div class="edge">
          <div class="lbl">Min price</div>
          <div class="pair">
            <input type="number" step="any" aria-label="Min price" :value="round2(l.lower)" @change="bt.updateLeg(l.id, { lower: Number(($event.target as HTMLInputElement).value) })" />
            <span class="pct">
              <input type="number" step="0.5" aria-label="Min price, percent from reference" :value="pctOf(l, l.lower)" :disabled="pctOf(l, l.lower) == null" @change="setPct(l, 'lo', ($event.target as HTMLInputElement).value)" />
              <i>%</i>
            </span>
          </div>
        </div>
        <div class="edge">
          <div class="lbl">Max price</div>
          <div class="pair">
            <input type="number" step="any" aria-label="Max price" :value="round2(l.upper)" @change="bt.updateLeg(l.id, { upper: Number(($event.target as HTMLInputElement).value) })" />
            <span class="pct">
              <input type="number" step="0.5" aria-label="Max price, percent from reference" :value="pctOf(l, l.upper)" :disabled="pctOf(l, l.upper) == null" @change="setPct(l, 'hi', ($event.target as HTMLInputElement).value)" />
              <i>%</i>
            </span>
          </div>
        </div>
        <label>
          <div class="lbl">When price exits</div>
          <select
            :value="!l.rebalance ? 'hold' : l.rebalanceSkipBelow ? 'recentre_up' : 'recentre'"
            title="Recentre closes the LP and the perps on the same asset at the daily close, then reopens them with the same range ratio centred on that price. 'Only above' skips exits below the range: the LP holds its range, all ETH, until price comes back."
            @change="setExitRule(l, ($event.target as HTMLSelectElement).value)"
          >
            <option value="hold">Hold range</option>
            <option value="recentre">Recentre (LP + perps)</option>
            <option value="recentre_up">Recentre only above range</option>
          </select>
        </label>
      </div>
      <div v-if="pctOf(l, l.lower) != null && pctOf(l, l.upper) != null" class="range-row">
        <RangeSlider
          v-bind="sliderSpan(l)"
          :lo="pctOf(l, l.lower)!"
          :hi="pctOf(l, l.upper)!"
          @change="(lo, hi) => bt.setRangePct(l.id, lo, hi)"
        />
        <div class="scale">
          <span>{{ sliderSpan(l).min }}%</span>
          <span class="ref">{{ refLabel(l) }}</span>
          <span>+{{ sliderSpan(l).max }}%</span>
        </div>
      </div>
      <div v-if="bt.mode === 'onchain' && bt.coverageLoaded" class="data-span">
        <template v-for="c in [bt.coverageFor(l.poolId)]" :key="l.id">
          <template v-if="c">
            <span>Swap data on disk: <b class="mono">{{ c.fullFrom }} → {{ c.fullTo }}</b> · {{ c.days }} days</span>
            <span v-if="windowInside(l.poolId)" class="ok">✓ window covered</span>
            <div style="flex:1" />
            <button v-if="c.days > 30" class="btn sm" @click="bt.useCoverageWindow(l.poolId, 30)">Last 30 days</button>
            <button class="btn sm" @click="bt.useCoverageWindow(l.poolId)">Use full range</button>
          </template>
          <span v-else class="warn">No swap data on disk for this pool — the whole window will be downloaded over RPC.</span>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="head">
        <VersionBadge version="gmx" />
        <span class="t" :style="{ color: l.kind === 'long' ? 'var(--long)' : 'var(--short)' }">{{ title(l) }}</span>
        <button class="icon-btn" aria-label="Remove leg" @click="bt.removeLeg(l.id)">×</button>
      </div>
      <div class="fields">
        <label>
          <div class="lbl">Market</div>
          <select :value="l.perpId" @change="bt.updateLeg(l.id, { perpId: ($event.target as HTMLSelectElement).value })">
            <option v-for="p in markets.perps" :key="p.id" :value="p.id">{{ p.id }}</option>
          </select>
        </label>
        <label>
          <div class="lbl lbl-row">
            <span>Collateral $</span>
            <button
              v-if="l.kind === 'short'"
              type="button"
              class="auto-chip"
              :class="{ on: l.autoCollateral }"
              :aria-pressed="!!l.autoCollateral"
              :title="collateralHelp(l)"
              @click.prevent="bt.updateLeg(l.id, { autoCollateral: !l.autoCollateral, capital: bt.collateralFor(l) })"
            >Auto</button>
          </div>
          <!-- Always editable: it shows the auto size while Auto is on, and
               typing a number takes over from it (Auto switches off). -->
          <input
            type="number"
            min="0"
            :value="bt.collateralFor(l)"
            :title="l.autoCollateral ? collateralHelp(l) + '. Type a number to set it yourself.' : ''"
            @change="bt.updateLeg(l.id, { capital: Number(($event.target as HTMLInputElement).value), autoCollateral: false })"
          />
        </label>
        <label :title="l.hedge && l.autoCollateral ? 'Auto collateral covers the hedge\'s largest size at this leverage' : ''">
          <div class="lbl">{{ l.hedge && l.autoCollateral ? 'Max leverage' : 'Leverage' }}</div>
          <input v-if="l.hedge && !l.autoCollateral" type="text" value="auto" disabled title="Notional follows the LP's ETH exposure, so leverage floats" />
          <input v-else type="number" min="0.1" step="0.5" :value="l.leverage" @change="bt.updateLeg(l.id, { leverage: Math.max(0.1, Number(($event.target as HTMLInputElement).value)) })" />
        </label>
        <label>
          <div class="lbl">Direction</div>
          <select :value="l.kind" @change="bt.updateLeg(l.id, { kind: ($event.target as HTMLSelectElement).value, hedge: false })">
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label v-if="l.kind === 'short'">
          <div class="lbl">Sizing</div>
          <select :value="l.hedge ? 'hedge' : 'fixed'" @change="bt.updateLeg(l.id, { hedge: ($event.target as HTMLSelectElement).value === 'hedge' })">
            <option value="fixed">Fixed size</option>
            <option value="hedge">Delta hedge</option>
          </select>
        </label>
        <template v-if="l.hedge">
          <label title="How often the short is checked against the LP's delta (the ETH it holds) and re-sized">
            <div class="lbl">Re-hedge every</div>
            <select :value="l.hedgeIntervalHours || 24" @change="bt.updateLeg(l.id, { hedgeIntervalHours: Number(($event.target as HTMLSelectElement).value) })">
              <option v-for="h in [1, 2, 4, 8, 12, 24]" :key="h" :value="h">{{ h === 24 ? 'day (at close)' : h === 1 ? 'hour' : h + ' hours' }}</option>
            </select>
          </label>
          <label title="Skip a re-hedge unless the short is off the LP's delta by more than this percent of the LP's value. 0 re-hedges at every check.">
            <div class="lbl">Band, % of LP</div>
            <input type="number" min="0" step="0.5" :value="l.hedgeBandPct ?? 0" @change="bt.updateLeg(l.id, { hedgeBandPct: Math.max(0, Number(($event.target as HTMLInputElement).value)) })" />
          </label>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.edge { grid-column: span 2; min-width: 0; }
.lbl-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.auto-chip {
  appearance: none; border: 1px solid var(--line); background: transparent; color: var(--txt-faint);
  font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: 6px; cursor: pointer;
}
.auto-chip.on { color: var(--accent); border-color: var(--accent-dim); background: rgba(77, 227, 177, .08); }
.pair { display: flex; gap: 6px; }
.pair > input { flex: 1; min-width: 0; }
.pct { position: relative; flex: 0 0 92px; }
.pct input { width: 100%; padding-right: 22px; }
.pct i {
  position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
  font-style: normal; font-size: 12px; color: var(--txt-faint); pointer-events: none;
}
.range-row { margin-top: 12px; }
.scale { display: flex; justify-content: space-between; gap: 8px; margin-top: 2px; font-size: 11px; color: var(--txt-faint); font-family: var(--mono); }
.scale .ref { font-family: var(--sans); text-align: center; }
.data-span {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line-soft);
  font-size: 12px; color: var(--txt-faint);
}
.data-span b { color: var(--txt); font-weight: 600; }
.data-span .ok { color: var(--long); }
.data-span .warn { color: var(--warn); }
</style>
