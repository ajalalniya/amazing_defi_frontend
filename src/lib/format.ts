export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export const fmtUsd = (v: number, dp?: number) => {
  const a = Math.abs(v)
  if (dp === undefined) dp = a < 10 ? 2 : 0
  if (a >= 1e9) return (v < 0 ? '-$' : '$') + (a / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v < 0 ? '-$' : '$') + (a / 1e6).toFixed(2) + 'M'
  if (a >= 1e4) return (v < 0 ? '-$' : '$') + (a / 1e3).toFixed(1) + 'K'
  return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export const fmtSigned = (v: number) => (v >= 0 ? '+' : '−') + fmtUsd(Math.abs(v))

export const pctDp = (v: number) => (Math.abs(v) < 1 ? 2 : Math.abs(v) < 10 ? 1 : 0)

export const fmtPct = (v: number, dp = 2) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dp) + '%'

export const fmtPctAuto = (v: number) => fmtPct(v, pctDp(v))

export const fmtNum = (v: number, dp = 2) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const fmtAmt = (v: number) => fmtNum(v, Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 4 : 6)

export const price$ = (v: number) => (v >= 1000 ? fmtNum(v, 2) : v >= 1 ? fmtNum(v, 4) : v.toFixed(6))

export const cls = (v: number) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim')

export const feePct = (feeBps: number) => (feeBps / 100).toFixed(2) + '%'
