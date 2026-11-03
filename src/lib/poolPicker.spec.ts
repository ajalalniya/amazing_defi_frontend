import { describe, expect, it } from 'vitest'
import type { Pool } from '@/api/types'
import { pickPool, poolPairs, poolTiers, poolVersions } from './poolPicker'

function pool(id: string, version: string, pair: string, feeBps: number, network = 'Base'): Pool {
  const [token0, token1] = pair.split('/')
  return { id, version, token0, token1, feeBps, network, price: 1, change24h: 0, tvl: 0, volume24h: 0, apr: 0, sigma: 0 }
}

const pools = [
  pool('v3-eth-usdc-030', 'v3', 'ETH/USDC', 30),
  pool('v3-eth-usdc-005', 'v3', 'ETH/USDC', 5),
  pool('v3-eth-usdc-005-arb', 'v3', 'ETH/USDC', 5, 'Arbitrum'),
  pool('v3-wbtc-usdc-005', 'v3', 'WBTC/USDC', 5),
  pool('v4-eth-usdc-005', 'v4', 'ETH/USDC', 5),
  pool('v4-arb-eth-030', 'v4', 'ARB/ETH', 30),
  pool('v4-rdnt-usdc-100', 'v4', 'RDNT/USDC', 100),
]

describe('poolPicker', () => {
  it('lists versions, pairs per version and tiers by fee', () => {
    expect(poolVersions(pools)).toEqual(['v3', 'v4'])
    expect(poolPairs(pools, 'v4')).toEqual(['ETH/USDC', 'ARB/ETH', 'RDNT/USDC'])
    expect(poolTiers(pools, 'v3', 'ETH/USDC').map((p) => p.feeBps)).toEqual([5, 5, 30])
  })

  it('keeps pair and fee tier when switching version', () => {
    const cur = pools[1]
    expect(pickPool(pools, cur, 'v4')?.id).toBe('v4-eth-usdc-005')
  })

  it('keeps network when the tier exists on several', () => {
    const cur = pools[2]
    expect(pickPool(pools, cur, 'v3', 'ETH/USDC')?.id).toBe('v3-eth-usdc-005-arb')
  })

  it('falls back to the first pair when the version lacks the current one', () => {
    const cur = pools[3]
    expect(pickPool(pools, cur, 'v4')?.id).toBe('v4-eth-usdc-005')
  })

  it('prefers a pool the caller favours when the fee tier changes', () => {
    const cur = pools[6]
    const onDisk = (p: Pool) => p.id === 'v3-eth-usdc-005'
    expect(pickPool(pools, cur, 'v3', 'ETH/USDC', onDisk)?.id).toBe('v3-eth-usdc-005')
  })
})
