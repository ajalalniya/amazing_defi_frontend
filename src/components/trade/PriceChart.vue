<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Candle } from '@/api/types'
import { price$ } from '@/lib/format'
import { gridY, setupCanvas } from '@/lib/rangeGeom'

const props = defineProps<{
  candles: Candle[]
  spot: number
  liq: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

function draw() {
  const cv = canvas.value
  if (!cv) return
  const { ctx, w, h } = setupCanvas(cv)
  const series = props.candles.length ? props.candles.map((c) => c.c) : [props.spot]
  const padL = 56, padR = 14, padT = 14, padB = 24
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB
  let lo = Math.min(...series), hi = Math.max(...series)
  const liq = props.liq
  if (liq > lo * 0.55 && liq < hi * 1.45) {
    lo = Math.min(lo, liq)
    hi = Math.max(hi, liq)
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const X = (i: number) => x0 + (i / Math.max(1, series.length - 1)) * (x1 - x0)
  const Y = (p: number) => y1 - ((p - lo) / (hi - lo || 1)) * (y1 - y0)
  for (let i = 0; i <= 4; i++) gridY(ctx, x0, x1, y0 + ((y1 - y0) * i) / 4, price$(hi - ((hi - lo) * i) / 4))
  const up = series[series.length - 1] >= series[0]
  const col = up ? '#3ddc97' : '#ff5d7a'
  const grad = ctx.createLinearGradient(0, y0, 0, y1)
  grad.addColorStop(0, up ? 'rgba(61,220,151,.26)' : 'rgba(255,93,122,.26)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.moveTo(X(0), Y(series[0]))
  series.forEach((p, i) => ctx.lineTo(X(i), Y(p)))
  ctx.lineTo(X(series.length - 1), y1)
  ctx.lineTo(X(0), y1)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(X(0), Y(series[0]))
  series.forEach((p, i) => ctx.lineTo(X(i), Y(p)))
  ctx.strokeStyle = col
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()
  if (liq > lo && liq < hi) {
    ctx.strokeStyle = 'rgba(255,93,122,.75)'
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x0, Y(liq))
    ctx.lineTo(x1, Y(liq))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ff5d7a'
    ctx.font = '600 10px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillText('liquidation ' + price$(liq), x0 + 6, Y(liq) - 5)
  }
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(X(series.length - 1), Y(props.spot), 3.5, 0, 7)
  ctx.fill()
  ctx.fillStyle = '#5b6376'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('120d', (x0 + x1) / 2, y1 + 16)
}

let rz: ReturnType<typeof setTimeout> | null = null
function onResize() {
  if (rz) clearTimeout(rz)
  rz = setTimeout(draw, 90)
}

onMounted(() => {
  draw()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))
watch(() => [props.candles, props.spot, props.liq], draw, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="price-canvas" />
</template>
