<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { DepthBin } from '@/api/types'
import { price$ } from '@/lib/format'
import {
  type Domain,
  type HitKind,
  gridY,
  hitTest,
  logP,
  logY,
  rangeDomain,
  roundRect,
  setupCanvas,
  shiftBand,
} from '@/lib/rangeGeom'

const props = defineProps<{
  series: number[]
  depth: DepthBin[]
  spot: number
  lower: number
  upper: number
  tfLabel: string
  pair: string
}>()

const emit = defineEmits<{
  'update:lower': [n: number]
  'update:upper': [n: number]
  'drag-start': []
  'drag-end': []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let frozen: Domain | null = null
let drag: { kind: HitKind; from: number; lo: number; hi: number } | null = null
let geom: {
  Y: (p: number) => number
  P: (y: number) => number
  x0: number
  x1: number
  y0: number
  y1: number
  px1: number
  hx0: number
  dom: Domain
} | null = null

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const { ctx, w, h } = setupCanvas(cv)
  const padL = 68, padR = 14, padT = 18, padB = 26
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB
  const histW = clamp((x1 - x0) * 0.24, 80, 150)
  const hx0 = x1 - histW
  const px1 = hx0 - 14
  const series = props.series.length ? props.series : [props.spot]
  const dom = frozen || rangeDomain(series, props.spot, props.lower, props.upper)
  const Y = (p: number) => logY(p, dom.lo, dom.hi, y0, y1)
  const P = (y: number) => logP(y, dom.lo, dom.hi, y0, y1)
  geom = { Y, P, x0, x1, y0, y1, px1, hx0, dom }

  const yTop = clamp(Y(props.upper), y0, y1)
  const yBot = clamp(Y(props.lower), y0, y1)

  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, 'rgba(77,227,177,.07)')
  g.addColorStop(1, 'rgba(77,227,177,.16)')
  ctx.fillStyle = g
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)

  ctx.font = '10px ui-monospace, monospace'
  for (let i = 0; i <= 4; i++) {
    const yy = y0 + ((y1 - y0) * i) / 4
    gridY(ctx, x0, x1, yy, price$(P(yy)))
  }

  const X = (i: number) => x0 + (i / Math.max(1, series.length - 1)) * (px1 - x0)
  const area = ctx.createLinearGradient(0, y0, 0, y1)
  area.addColorStop(0, 'rgba(143,155,196,.22)')
  area.addColorStop(1, 'rgba(143,155,196,0)')
  ctx.beginPath()
  ctx.moveTo(X(0), Y(series[0]))
  series.forEach((p, i) => ctx.lineTo(X(i), Y(p)))
  ctx.lineTo(X(series.length - 1), y1)
  ctx.lineTo(X(0), y1)
  ctx.closePath()
  ctx.fillStyle = area
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(X(0), Y(series[0]))
  series.forEach((p, i) => ctx.lineTo(X(i), Y(p)))
  ctx.strokeStyle = '#8f9bc4'
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.fillStyle = '#c3cbe4'
  ctx.beginPath()
  ctx.arc(X(series.length - 1), Y(props.spot), 3, 0, 7)
  ctx.fill()

  ctx.fillStyle = '#5b6376'
  ctx.textAlign = 'left'
  ctx.fillText('−' + props.tfLabel, x0, y1 + 16)
  ctx.textAlign = 'right'
  ctx.fillText('now', px1, y1 + 16)

  const bins = props.depth
  const bh = bins.length ? (y1 - y0) / bins.length : 4
  bins.forEach((b) => {
    const yb = Y(b.price)
    const len = Math.max(2, b.depth * (histW - 8))
    const inside = b.price >= props.lower && b.price <= props.upper
    ctx.fillStyle = inside ? 'rgba(77,227,177,.62)' : '#2b3346'
    ctx.fillRect(hx0, yb - bh * 0.38, len, Math.max(1.5, bh * 0.76))
  })
  ctx.fillStyle = '#5b6376'
  ctx.textAlign = 'left'
  ctx.fillText('liquidity', hx0, y0 - 6)
  ctx.textAlign = 'right'
  ctx.fillText(props.pair, px1, y0 - 6)

  const sy = Y(props.spot)
  ctx.strokeStyle = '#ffc861'
  ctx.lineWidth = 1.4
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(x0, sy)
  ctx.lineTo(x1, sy)
  ctx.stroke()
  ctx.setLineDash([])

  ;[
    [yBot, props.lower, props.lower < dom.lo],
    [yTop, props.upper, props.upper > dom.hi],
  ].forEach(([y, p, clipped]) => {
    const yy = y as number
    ctx.strokeStyle = '#4de3b1'
    ctx.lineWidth = 1.8
    if (clipped) ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x1, yy)
    ctx.stroke()
    ctx.setLineDash([])

    const gx = px1 - 30
    ctx.fillStyle = '#4de3b1'
    roundRect(ctx, gx, yy - 5.5, 28, 11, 3)
    ctx.fill()
    ctx.fillStyle = '#08120e'
    for (let k = -1; k <= 1; k++) ctx.fillRect(gx + 14 + k * 4 - 0.5, yy - 2.5, 1, 5)

    const t = (clipped ? '↕ ' : '') + price$(p as number)
    ctx.font = '600 10px ui-monospace, monospace'
    const tw = Math.min(padL - 6, ctx.measureText(t).width + 10)
    ctx.fillStyle = 'rgba(77,227,177,.16)'
    roundRect(ctx, x0 - tw - 5, yy - 8, tw, 16, 4)
    ctx.fill()
    ctx.fillStyle = '#4de3b1'
    ctx.textAlign = 'center'
    ctx.fillText(t, x0 - tw / 2 - 5, yy + 3.5)
  })

  ctx.font = '600 10px ui-monospace, monospace'
  const st = price$(props.spot)
  const stw = ctx.measureText(st).width + 12
  ctx.fillStyle = '#14161d'
  roundRect(ctx, x1 - stw, sy - 8, stw, 16, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,200,97,.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#ffc861'
  ctx.textAlign = 'center'
  ctx.fillText(st, x1 - stw / 2, sy + 3.5)
}

function pointerY(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return e.clientY - r.top
}

function onDown(e: PointerEvent) {
  if (!geom || !canvas.value) return
  const y = pointerY(e)
  const kind = hitTest(y, geom.Y(props.lower), geom.Y(props.upper))
  if (!kind) return
  frozen = geom.dom
  drag = { kind, from: geom.P(clamp(y, geom.y0, geom.y1)), lo: props.lower, hi: props.upper }
  emit('drag-start')
  try { canvas.value.setPointerCapture(e.pointerId) } catch { /* nicety */ }
  canvas.value.style.cursor = kind === 'band' ? 'grabbing' : 'ns-resize'
}

function onMove(e: PointerEvent) {
  if (!geom || !canvas.value) return
  const y = pointerY(e)
  if (!drag) {
    const kind = hitTest(y, geom.Y(props.lower), geom.Y(props.upper))
    canvas.value.style.cursor = kind === 'band' ? 'grab' : kind ? 'ns-resize' : 'default'
    return
  }
  const p = geom.P(clamp(y, geom.y0, geom.y1))
  if (drag.kind === 'lo') emit('update:lower', Math.min(p, props.upper * 0.985))
  else if (drag.kind === 'hi') emit('update:upper', Math.max(p, props.lower * 1.015))
  else {
    const next = shiftBand(drag.lo, drag.hi, drag.from, p)
    emit('update:lower', next.lo)
    emit('update:upper', next.hi)
  }
}

function endDrag() {
  if (!drag) return
  drag = null
  frozen = null
  if (canvas.value) canvas.value.style.cursor = 'default'
  emit('drag-end')
}

let rz: ReturnType<typeof setTimeout> | null = null
function onResize() {
  if (rz) clearTimeout(rz)
  rz = setTimeout(draw, 90)
}

let mql: MediaQueryList | null = null
function onDpr() { draw() }

onMounted(() => {
  draw()
  window.addEventListener('resize', onResize)
  mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  mql.addEventListener?.('change', onDpr)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  mql?.removeEventListener?.('change', onDpr)
})
watch(() => [props.series, props.depth, props.spot, props.lower, props.upper, props.tfLabel], draw, { deep: true })
</script>

<template>
  <div class="chart-shell">
    <canvas
      ref="canvas"
      class="range-canvas"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    />
  </div>
</template>
