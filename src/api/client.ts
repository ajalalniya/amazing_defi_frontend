import type {
  BacktestRequest,
  BacktestResult,
  Candle,
  HistoryCoverage,
  DepthBin,
  LPQuote,
  Perp,
  PerpQuote,
  Pool,
  Portfolio,
  Position,
  Status,
  Timeframe,
} from './types'

const BASE = ''

export type BacktestProgress = {
  stage?: string
  percent: number
  message: string
  detail?: string
}

export type StreamEvent =
  | ({ type: 'progress' } & BacktestProgress)
  | { type: 'result'; result: BacktestResult }
  | { type: 'error'; error: { code?: string; message: string } }

export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  return JSON.parse(trimmed) as StreamEvent
}

function apiError(message: string, code?: string, status?: number) {
  const err = new Error(message) as Error & { code?: string; status?: number }
  err.code = code
  err.status = status
  return err
}

async function throwIfHttpError(res: Response, text: string): Promise<void> {
  if (res.ok) return
  let data: { error?: { message?: string; code?: string } } | null = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  throw apiError(data?.error?.message || res.statusText, data?.error?.code, res.status)
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw apiError(data?.error?.message || res.statusText, data?.error?.code, res.status)
  }
  return data as T
}

async function backtestStream(
  body: BacktestRequest,
  onProgress?: (p: BacktestProgress) => void,
): Promise<BacktestResult> {
  const res = await fetch(BASE + '/api/v1/backtest?stream=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify(body),
  })
  const ct = res.headers.get('content-type') || ''
  if (!res.body || !ct.includes('ndjson')) {
    const text = await res.text()
    await throwIfHttpError(res, text)
    return (text ? JSON.parse(text) : null) as BacktestResult
  }
  if (!res.ok) {
    const text = await res.text()
    await throwIfHttpError(res, text)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let result: BacktestResult | null = null
  while (true) {
    const { done, value } = await reader.read()
    buf += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const ev = parseStreamLine(line)
      if (!ev) continue
      if (ev.type === 'progress') onProgress?.(ev)
      else if (ev.type === 'result') result = ev.result
      else if (ev.type === 'error') throw apiError(ev.error?.message || 'Backtest failed', ev.error?.code, res.status)
    }
    if (done) break
  }
  const tail = parseStreamLine(buf)
  if (tail?.type === 'progress') onProgress?.(tail)
  else if (tail?.type === 'result') result = tail.result
  else if (tail?.type === 'error') throw apiError(tail.error?.message || 'Backtest failed', tail.error?.code, res.status)
  if (!result) throw apiError('Backtest ended without a result')
  return result
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
  backtest: (body: BacktestRequest, onProgress?: (p: BacktestProgress) => void) =>
    body.source === 'onchain'
      ? backtestStream(body, onProgress)
      : req<BacktestResult>('/api/v1/backtest', { method: 'POST', body: JSON.stringify(body) }),
  historyCoverage: () => req<{ coverage: HistoryCoverage[] }>('/api/v1/history/coverage'),
  // A pool's daily close on a date, from the swaps on disk (404 off the CSV).
  historyPrice: (poolId: string, date: string) =>
    req<{ poolId: string; date: string; price: number }>(
      `/api/v1/history/price?poolId=${encodeURIComponent(poolId)}&date=${encodeURIComponent(date)}`,
    ),
  timeframes: () => req<{ timeframes: Timeframe[] }>('/api/v1/timeframes'),
  status: () => req<Status>('/api/v1/status'),
}

export function wsUrl(owner: string): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/v1/ws?owner=${encodeURIComponent(owner)}`
}
