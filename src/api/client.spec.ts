import { describe, expect, it } from 'vitest'
import { parseStreamLine } from './client'

describe('backtest stream lines', () => {
  it('ignores blank lines', () => {
    expect(parseStreamLine('')).toBeNull()
    expect(parseStreamLine('  \n')).toBeNull()
  })

  it('parses progress percent', () => {
    const ev = parseStreamLine('{"type":"progress","percent":42,"message":"Downloading swaps","detail":"blocks 100 / 200"}')
    expect(ev).toEqual({
      type: 'progress',
      percent: 42,
      message: 'Downloading swaps',
      detail: 'blocks 100 / 200',
    })
  })

  it('parses result and error events', () => {
    const result = parseStreamLine('{"type":"result","result":{"days":30,"capital":1}}')
    expect(result?.type).toBe('result')
    if (result?.type === 'result') expect(result.result.days).toBe(30)
    const err = parseStreamLine('{"type":"error","error":{"code":"rpc_error","message":"timeout"}}')
    expect(err).toEqual({ type: 'error', error: { code: 'rpc_error', message: 'timeout' } })
  })
})
