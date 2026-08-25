import type {
  BacktestRequest,
  BacktestResult,
  Candle,
  DepthBin,
  LPQuote,
  Perp,
  PerpQuote,
  Pool,
  Portfolio,
  Position,
  Timeframe,
} from './types'

const BASE = ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText
    const err = new Error(msg) as Error & { code?: string; status?: number }
    err.code = data?.error?.code
    err.status = res.status
    throw err
  }
  return data as T
}

export const api = {
  pools: (version = 'all', q = '') => {
    const p = new URLSearchParams()
    if (version) p.set('version', version)
    if (q) p.set('q', q)
    return req<{ pools: Pool[] }>(`/api/v1/pools?${p}`)
  },
  pool: (id: string) => req<Pool>(`/api/v1/pools/${encodeURIComponent(id)}`),
  depth: (id: string, bins = 48, lo?: number, hi?: number) => {
    const p = new URLSearchParams({ bins: String(bins) })
    if (lo && hi) {
      p.set('lo', String(lo))
      p.set('hi', String(hi))
    }
    return req<{ bins: DepthBin[] }>(`/api/v1/pools/${encodeURIComponent(id)}/depth?${p}`)
  },
  poolCandles: (id: string, tf: string) =>
    req<{ timeframe: Timeframe; candles: Candle[] }>(
      `/api/v1/pools/${encodeURIComponent(id)}/candles?tf=${encodeURIComponent(tf)}`,
    ),
  perps: () => req<{ perps: Perp[] }>('/api/v1/perps'),
  perp: (id: string) => req<Perp>(`/api/v1/perps/${encodeURIComponent(id)}`),
  perpCandles: (id: string, tf: string) =>
    req<{ timeframe: Timeframe; candles: Candle[] }>(
      `/api/v1/perps/${encodeURIComponent(id)}/candles?tf=${encodeURIComponent(tf)}`,
    ),
  quoteLp: (body: { poolId: string; lower: number; upper: number; amount0?: number; amount1?: number; capitalUsd?: number }) =>
    req<LPQuote>('/api/v1/quotes/lp', { method: 'POST', body: JSON.stringify(body) }),
  quotePerp: (body: { perpId: string; side: string; collateral: number; leverage: number }) =>
    req<PerpQuote>('/api/v1/quotes/perp', { method: 'POST', body: JSON.stringify(body) }),
  portfolio: (owner: string) => req<Portfolio>(`/api/v1/portfolio?owner=${encodeURIComponent(owner)}`),
  openPosition: (body: Record<string, unknown>) =>
    req<Position>('/api/v1/positions', { method: 'POST', body: JSON.stringify(body) }),
  closePosition: (id: string, owner: string) =>
    req<{ id: string; realisedPnl: number }>(
      `/api/v1/positions/${encodeURIComponent(id)}?owner=${encodeURIComponent(owner)}`,
      { method: 'DELETE' },
    ),
  backtest: (body: BacktestRequest) =>
    req<BacktestResult>('/api/v1/backtest', { method: 'POST', body: JSON.stringify(body) }),
  timeframes: () => req<{ timeframes: Timeframe[] }>('/api/v1/timeframes'),
}

export function wsUrl(owner: string): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/v1/ws?owner=${encodeURIComponent(owner)}`
}
