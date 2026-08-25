<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { BacktestResult } from '@/api/types'
import { gridY, setupCanvas } from '@/lib/rangeGeom'

const props = defineProps<{
  result: BacktestResult | null
  mode: 'combined' | 'legs'
}>()
const emit = defineEmits<{ legend: [html: { name: string; color: string; pct: number }[]] }>()

const COLORS = ['#4de3b1', '#ff5d7a', '#63a4ff', '#a78bfa', '#ffc861', '#f78bd0']
const canvas = ref<HTMLCanvasElement | null>(null)

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)) }

function draw() {
  const cv = canvas.value
  if (!cv) return
  const { ctx, w, h } = setupCanvas(cv)
  const r = props.result
  if (!r) {
    ctx.fillStyle = '#4a5265'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Run a backtest to plot the equity curve', w / 2, h / 2)
    emit('legend', [])
    return
  }
  const padL = 62, padR = 16, padT = 14, padB = 26
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB
  const series = props.mode === 'combined'
    ? [{ name: 'Combined', data: r.combined, color: '#4de3b1', base: r.capital }]
    : r.legs.map((x, i) => ({ name: x.title, data: x.series, color: COLORS[i % COLORS.length], base: x.capital }))
  const pct = series.map((s) => ({ ...s, data: s.data.map((v) => (v / s.base - 1) * 100) }))
  let lo = Math.min(0, ...pct.flatMap((s) => s.data))
  let hi = Math.max(0, ...pct.flatMap((s) => s.data))
  const pad = Math.max(2, (hi - lo) * 0.12)
  lo -= pad
  hi += pad
  const N = r.days
  const X = (i: number) => x0 + (i / N) * (x1 - x0)
  const Y = (v: number) => y1 - ((v - lo) / (hi - lo || 1)) * (y1 - y0)
  for (let i = 0; i <= 4; i++) {
    const v = hi - ((hi - lo) * i) / 4
    gridY(ctx, x0, x1, Y(v), (v >= 0 ? '+' : '') + v.toFixed(0) + '%')
  }
  ctx.strokeStyle = '#333a4c'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, Y(0) + 0.5)
  ctx.lineTo(x1, Y(0) + 0.5)
  ctx.stroke()
  if (pct.length === 1) {
    const s = pct[0]
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    const upC = s.data[N] >= 0
    g.addColorStop(0, upC ? 'rgba(77,227,177,.24)' : 'rgba(255,93,122,.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.moveTo(X(0), Y(s.data[0]))
    s.data.forEach((v, i) => ctx.lineTo(X(i), Y(v)))
    ctx.lineTo(X(N), Y(0))
    ctx.lineTo(X(0), Y(0))
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
  }
  pct.forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(X(0), Y(s.data[0]))
    s.data.forEach((v, i) => ctx.lineTo(X(i), Y(v)))
    ctx.strokeStyle = s.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(X(N), Y(s.data[N]), 3.2, 0, 7)
    ctx.fill()
  })
  ctx.fillStyle = '#5b6376'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ;[0, 0.5, 1].forEach((f) => ctx.fillText('d' + Math.round(N * f), clamp(X(N * f), x0 + 12, x1 - 12), y1 + 16))
  emit('legend', pct.map((s) => ({ name: s.name, color: s.color, pct: s.data[N] })))
}

let rz: ReturnType<typeof setTimeout> | null = null
onMounted(() => {
  draw()
  window.addEventListener('resize', () => { if (rz) clearTimeout(rz); rz = setTimeout(draw, 90) })
})
onUnmounted(() => window.removeEventListener('resize', draw))
watch(() => [props.result, props.mode], draw, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="bt-canvas" />
</template>
