<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { BacktestResult } from '@/api/types'
import { gridY, lpRangeAt, setupCanvas } from '@/lib/rangeGeom'

const props = defineProps<{
  result: BacktestResult | null
  mode: 'combined' | 'legs'
}>()
const emit = defineEmits<{ legend: [html: { name: string; color: string; pct: number }[]] }>()

const COLORS = ['#4de3b1', '#ff5d7a', '#63a4ff', '#a78bfa', '#ffc861', '#f78bd0']
// Price is a reference for the equity curve, not one of its series, so it is
// drawn in neutral ink rather than taking a categorical hue.
const PRICE_INK = '#c3c9d6'
const RANGE_FILL = 'rgba(99,164,255,.10)'
const RANGE_EDGE = 'rgba(99,164,255,.55)'
const MUTED = '#5b6376'
const GAP = 26 // between the equity and price panels

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const hover = ref<number | null>(null)
const tip = ref<{ x: number; y: number; flip: boolean } | null>(null)

// Geometry of the last draw, for mapping the pointer back to a day.
let geom: { x0: number; x1: number; N: number } | null = null

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)) }

const hasPrice = computed(() => {
  const r = props.result
  return !!r?.price && r.price.length === r.combined.length && r.price.some((p) => p > 0)
})

// The first LP leg with a range, shaded on the price panel. A rebalancing leg
// moves its range, so `at(i)` is the range in force over day i.
const lpRange = computed(() => {
  const l = props.result?.legs.find((x) => x.kind === 'lp' && lpRangeAt(x, 0))
  if (!l) return null
  const n = props.result!.combined.length
  const spans = Array.from({ length: n }, (_, i) => lpRangeAt(l, i)!)
  return {
    title: l.title,
    at: (i: number) => spans[Math.min(Math.max(i, 0), n - 1)],
    lower: Math.min(...spans.map((r) => r.lower)),
    upper: Math.max(...spans.map((r) => r.upper)),
    last: spans[n - 1],
    moves: l.rebalanceDays || [],
  }
})

function dayLabel(i: number) {
  const r = props.result
  if (r?.from) {
    const d = new Date(r.from + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
  }
  return 'd' + i
}

function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toPrecision(4)
}

type Line = { name: string; data: number[]; color: string; base: number; usd?: number[] }

// LP fees are collected to the side, not reinvested, so they get their own
// line: the fund (positions alone) shows how well the hedge holds value, and
// the fees line shows what was earned on top. `usd` is what the tooltip reads
// when it differs from `data` (a fees line is plotted as capital + fees).
function series() {
  const r = props.result!
  const n = r.combined.length
  const lpFees = r.legs.filter((x) => x.kind === 'lp' && x.fees?.length === n)
  let raw: Line[]
  if (props.mode === 'combined') {
    if (!lpFees.length) {
      raw = [{ name: 'Combined', data: r.combined, color: '#4de3b1', base: r.capital }]
    } else {
      const fees = r.combined.map((_, d) => lpFees.reduce((s, x) => s + x.fees![d], 0))
      raw = [
        { name: 'Fund excl. fees', data: r.combined.map((v, d) => v - fees[d]), color: '#63a4ff', base: r.capital },
        { name: 'Fees collected', data: fees.map((f) => r.capital + f), usd: fees, color: '#ffc861', base: r.capital },
        { name: 'Total incl. fees', data: r.combined, color: '#4de3b1', base: r.capital },
      ]
    }
  } else {
    raw = r.legs.flatMap((x, i) => {
      const color = COLORS[i % COLORS.length]
      if (x.kind !== 'lp' || x.fees?.length !== x.series.length) return [{ name: x.title, data: x.series, color, base: x.capital }]
      return [
        { name: `${x.title} excl. fees`, data: x.series.map((v, d) => v - x.fees![d]), color, base: x.capital },
        { name: `Fees · ${x.title.replace(/^LP · /, '')}`, data: x.fees.map((f) => x.capital + f), usd: x.fees, color: '#ffc861', base: x.capital },
      ]
    })
  }
  return raw.map((s) => ({ ...s, pct: s.data.map((v) => (v / s.base - 1) * 100) }))
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const { ctx, w, h } = setupCanvas(cv)
  const r = props.result
  if (!r) {
    geom = null
    ctx.fillStyle = '#4a5265'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Run a backtest to plot the equity curve', w / 2, h / 2)
    emit('legend', [])
    return
  }

  const padL = 62, padR = 16, padT = 14, padB = 26
  const x0 = padL, x1 = w - padR
  const withPrice = hasPrice.value
  // Equity takes ~60% of the height; price sits underneath on its own scale.
  const eqTop = padT
  const eqBot = withPrice ? Math.round(padT + (h - padT - padB - GAP) * 0.6) : h - padB
  const pxTop = eqBot + GAP
  const pxBot = h - padB

  const ss = series()
  const N = Math.max(1, (ss[0]?.data.length || 1) - 1)
  geom = { x0, x1, N }
  const X = (i: number) => x0 + (i / N) * (x1 - x0)

  // ---- equity panel -------------------------------------------------------
  let lo = Math.min(0, ...ss.flatMap((s) => s.pct))
  let hi = Math.max(0, ...ss.flatMap((s) => s.pct))
  const pad = Math.max(2, (hi - lo) * 0.12)
  lo -= pad
  hi += pad
  const Y = (v: number) => eqBot - ((v - lo) / (hi - lo || 1)) * (eqBot - eqTop)
  const eqTicks = withPrice ? 3 : 4
  for (let i = 0; i <= eqTicks; i++) {
    const v = hi - ((hi - lo) * i) / eqTicks
    gridY(ctx, x0, x1, Y(v), (v >= 0 ? '+' : '') + v.toFixed(0) + '%')
  }
  ctx.strokeStyle = '#333a4c'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, Y(0) + 0.5)
  ctx.lineTo(x1, Y(0) + 0.5)
  ctx.stroke()
  if (ss.length === 1) {
    const s = ss[0]
    const g = ctx.createLinearGradient(0, eqTop, 0, eqBot)
    const upC = s.pct[N] >= 0
    g.addColorStop(0, upC ? 'rgba(77,227,177,.24)' : 'rgba(255,93,122,.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.moveTo(X(0), Y(s.pct[0]))
    s.pct.forEach((v, i) => ctx.lineTo(X(i), Y(v)))
    ctx.lineTo(X(N), Y(0))
    ctx.lineTo(X(0), Y(0))
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
  }
  ss.forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(X(0), Y(s.pct[0]))
    s.pct.forEach((v, i) => ctx.lineTo(X(i), Y(v)))
    ctx.strokeStyle = s.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(X(N), Y(s.pct[N]), 3.2, 0, 7)
    ctx.fill()
  })

  // ---- price panel --------------------------------------------------------
  let PY: ((v: number) => number) | null = null
  if (withPrice) {
    const px = r.price!
    let plo = Math.min(...px.filter((p) => p > 0))
    let phi = Math.max(...px)
    const rng = lpRange.value
    // Fit the range band too when it is near the price, so in/out of range
    // reads at a glance; a band far away would flatten the line, so it gets
    // an edge note instead.
    if (rng) {
      const span = phi - plo || phi * 0.05
      if (rng.lower > plo - span && rng.lower < phi + span) plo = Math.min(plo, rng.lower)
      if (rng.upper > plo - span && rng.upper < phi + span) phi = Math.max(phi, rng.upper)
    }
    const ppad = (phi - plo || phi * 0.02) * 0.1
    plo -= ppad
    phi += ppad
    PY = (v: number) => pxBot - ((v - plo) / (phi - plo || 1)) * (pxBot - pxTop)

    for (let i = 0; i <= 2; i++) {
      const v = phi - ((phi - plo) * i) / 2
      gridY(ctx, x0, x1, PY(v), fmtPrice(v))
    }

    if (rng) {
      // One band per day, so a recentred range steps to its new level on the
      // day after the close it was reopened at.
      const segs = Array.from({ length: N }, (_, i) => ({ xa: X(i), xb: X(i + 1), r: rng.at(i + 1) }))
      ctx.fillStyle = RANGE_FILL
      for (const { xa, xb, r } of segs) {
        const top = clamp(PY(r.upper), pxTop, pxBot)
        const bot = clamp(PY(r.lower), pxTop, pxBot)
        if (bot - top > 0.5) ctx.fillRect(xa, top, xb - xa, bot - top)
      }
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = RANGE_EDGE
      ctx.lineWidth = 1
      for (const edge of ['lower', 'upper'] as const) {
        ctx.beginPath()
        segs.forEach(({ xa, xb, r }, i) => {
          const y = Math.round(clamp(PY!(r[edge]), pxTop, pxBot)) + 0.5
          if (i) ctx.lineTo(xa, y)
          else ctx.moveTo(xa, y)
          ctx.lineTo(xb, y)
        })
        ctx.stroke()
      }
      ctx.restore()
      // A tick under each close the LP was recentred at.
      ctx.fillStyle = RANGE_EDGE
      for (const d of rng.moves) {
        const x = X(d)
        ctx.beginPath()
        ctx.moveTo(x, pxBot)
        ctx.lineTo(x - 4, pxBot + 6)
        ctx.lineTo(x + 4, pxBot + 6)
        ctx.closePath()
        ctx.fill()
      }
      // Labelled in the panel's header row, clear of the price line.
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillStyle = MUTED
      ctx.textAlign = 'right'
      const cur = rng.last
      let note = `LP range ${fmtPrice(cur.lower)}–${fmtPrice(cur.upper)}`
      if (rng.moves.length) note += ` · recentred ${rng.moves.length}×`
      if (PY(cur.lower) < pxTop) note += '  ↑ above chart'
      else if (PY(cur.upper) > pxBot) note += '  ↓ below chart'
      ctx.fillText(note, x1, pxTop - 8)
    }

    ctx.beginPath()
    px.forEach((v, i) => (i ? ctx.lineTo(X(i), PY!(v)) : ctx.moveTo(X(i), PY!(v))))
    ctx.strokeStyle = PRICE_INK
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillStyle = MUTED
    ctx.textAlign = 'left'
    ctx.fillText(`${r.priceLabel || 'Price'} price`, x0, pxTop - 8)
  }

  // ---- shared x axis ------------------------------------------------------
  ctx.fillStyle = MUTED
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ;[0, 0.5, 1].forEach((f) => {
    const i = Math.round(N * f)
    ctx.fillText(dayLabel(i), clamp(X(i), x0 + 18, x1 - 18), pxBot + 16)
  })

  // ---- hover crosshair, through both panels -------------------------------
  const hi_ = hover.value
  if (hi_ != null && hi_ >= 0 && hi_ <= N) {
    const x = Math.round(X(hi_)) + 0.5
    ctx.strokeStyle = '#4a5265'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, eqTop)
    ctx.lineTo(x, withPrice ? pxBot : eqBot)
    ctx.stroke()
    // A ring of surface colour keeps the dot legible where lines cross.
    const dot = (y: number, c: string) => {
      ctx.beginPath()
      ctx.arc(x, y, 4.5, 0, 7)
      ctx.fillStyle = '#0d0f15'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 3.2, 0, 7)
      ctx.fillStyle = c
      ctx.fill()
    }
    ss.forEach((s) => dot(Y(s.pct[hi_]), s.color))
    if (PY && r.price) dot(PY(r.price[hi_]), PRICE_INK)
  }

  emit('legend', ss.map((s) => ({ name: s.name, color: s.color, pct: s.pct[N] })))
}

const tipRows = computed(() => {
  const r = props.result
  const i = hover.value
  if (!r || i == null) return null
  const ss = series()
  const rows = ss.map((s) => ({
    name: s.name,
    color: s.color,
    value: `${s.pct[i] >= 0 ? '+' : ''}${s.pct[i].toFixed(2)}%`,
    sub: '$' + Math.round((s.usd ?? s.data)[i]).toLocaleString('en-US'),
  }))
  let price: { label: string; value: string; range?: string } | null = null
  if (hasPrice.value && r.price) {
    const p = r.price[i]
    const rng = lpRange.value
    const cur = rng?.at(i)
    let range: string | undefined
    if (cur) {
      range = p >= cur.lower && p <= cur.upper ? 'in LP range' : 'out of LP range'
      if (rng!.moves.includes(i)) range += ` · recentred to ${fmtPrice(rng!.at(i + 1).lower)}–${fmtPrice(rng!.at(i + 1).upper)}`
    }
    price = { label: `${r.priceLabel || 'Price'}`, value: fmtPrice(p), range }
  }
  return { date: dayLabel(i), rows, price }
})

function onMove(e: PointerEvent) {
  const cv = canvas.value
  if (!cv || !geom || !props.result) return
  const rect = cv.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const { x0, x1, N } = geom
  if (mx < x0 - 12 || mx > x1 + 12) return onLeave()
  hover.value = Math.round(clamp((mx - x0) / (x1 - x0), 0, 1) * N)
  const x = x0 + (hover.value / N) * (x1 - x0)
  tip.value = { x, y: e.clientY - rect.top, flip: x > rect.width * 0.62 }
}

function onLeave() {
  hover.value = null
  tip.value = null
}

function onResize() {
  if (rz) clearTimeout(rz)
  rz = setTimeout(draw, 90)
}

let rz: ReturnType<typeof setTimeout> | null = null
onMounted(() => {
  draw()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))
watch(() => [props.result, props.mode], () => { onLeave(); draw() }, { deep: true })
watch(hover, draw)
</script>

<template>
  <div ref="wrap" class="bt-chart" @pointermove="onMove" @pointerleave="onLeave">
    <canvas ref="canvas" class="bt-canvas" :class="{ 'with-price': hasPrice }" />
    <div
      v-if="tip && tipRows"
      class="bt-tip"
      :style="{ left: tip.x + 'px', top: Math.max(8, tip.y - 40) + 'px', transform: tip.flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }"
    >
      <div class="bt-tip-date">{{ tipRows.date }}</div>
      <div v-for="row in tipRows.rows" :key="row.name" class="bt-tip-row">
        <i :style="{ background: row.color }" /><span>{{ row.name }}</span>
        <b class="mono">{{ row.value }}</b><small class="mono">{{ row.sub }}</small>
      </div>
      <div v-if="tipRows.price" class="bt-tip-row">
        <i class="price" /><span>{{ tipRows.price.label }}</span>
        <b class="mono">{{ tipRows.price.value }}</b><small v-if="tipRows.price.range">{{ tipRows.price.range }}</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bt-chart { position: relative; touch-action: pan-y; }
.bt-canvas.with-price { height: 400px; }
.bt-tip {
  position: absolute; pointer-events: none; z-index: 2; min-width: 190px;
  background: #11141c; border: 1px solid var(--line); border-radius: 8px;
  padding: 8px 10px; font-size: 12px; color: var(--txt); box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.bt-tip-date { color: var(--txt-dim); font-size: 11px; margin-bottom: 4px; }
.bt-tip-row { display: grid; grid-template-columns: 10px 1fr auto; column-gap: 8px; align-items: center; padding: 2px 0; }
.bt-tip-row i { width: 9px; height: 9px; border-radius: 3px; }
.bt-tip-row i.price { background: #c3c9d6; height: 2px; border-radius: 1px; }
.bt-tip-row span { color: var(--txt-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-tip-row small { grid-column: 2 / 4; color: var(--txt-faint); text-align: right; font-size: 11px; }
</style>
