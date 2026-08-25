export type Domain = { lo: number; hi: number }

export function rangeDomain(series: number[], spot: number, lower: number, upper: number): Domain {
  let mn = Math.min(spot, ...series)
  let mx = Math.max(spot, ...series)
  mn = Math.min(mn, Math.max(lower, mn / 2.2))
  mx = Math.max(mx, Math.min(upper, mx * 2.2))
  const pad = Math.pow(mx / mn, 0.07)
  return { lo: mn / pad, hi: mx * pad }
}

export function logY(p: number, lo: number, hi: number, y0: number, y1: number): number {
  return y1 - (Math.log(p / lo) / Math.log(hi / lo)) * (y1 - y0)
}

export function logP(y: number, lo: number, hi: number, y0: number, y1: number): number {
  return lo * Math.pow(hi / lo, (y1 - y) / (y1 - y0))
}

export const HANDLE_HIT = 14

export type HitKind = 'lo' | 'hi' | 'band' | null

export function hitTest(
  y: number,
  yLower: number,
  yUpper: number,
): HitKind {
  const dLo = Math.abs(y - yLower)
  const dHi = Math.abs(y - yUpper)
  if (Math.min(dLo, dHi) <= HANDLE_HIT) return dLo < dHi ? 'lo' : 'hi'
  if (y > yUpper && y < yLower) return 'band'
  return null
}

export function shiftBand(lo: number, hi: number, from: number, to: number): { lo: number; hi: number } {
  const k = to / from
  return { lo: lo * k, hi: hi * k }
}

export function setupCanvas(cv: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight || Number(cv.getAttribute('height')) || 0
  cv.width = Math.max(1, Math.round(w * dpr))
  cv.height = Math.max(1, Math.round(h * dpr))
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return { ctx, w, h }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

export function gridY(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, label?: string) {
  ctx.strokeStyle = '#1a1d27'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, y + 0.5)
  ctx.lineTo(x1, y + 0.5)
  ctx.stroke()
  if (label) {
    ctx.fillStyle = '#5b6376'
    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.fillText(label, x0 - 8, y + 3.5)
  }
}
