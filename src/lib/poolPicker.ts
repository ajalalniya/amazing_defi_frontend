import type { Pool } from '@/api/types'

// An LP leg stores one poolId; the editor offers it as three linked choices —
// version, then pair, then the fee tier (and network/hook) within that pair.

export function pairOf(p: Pool) {
  return `${p.token0}/${p.token1}`
}

export function poolVersions(pools: Pool[]) {
  return [...new Set(pools.map((p) => p.version))].sort()
}

export function poolPairs(pools: Pool[], version: string) {
  return [...new Set(pools.filter((p) => p.version === version).map(pairOf))]
}

export function poolTiers(pools: Pool[], version: string, pair: string) {
  return pools.filter((p) => p.version === version && pairOf(p) === pair).sort((a, b) => a.feeBps - b.feeBps)
}

// pickPool resolves a version/pair change to a concrete pool, keeping as much
// of the current choice as the new combination allows: the same pair, then the
// same fee tier and network, then a pool `preferred` accepts (e.g. one with
// swap data on disk), then the first match.
export function pickPool(
  pools: Pool[],
  current: Pool | undefined,
  version: string,
  pair?: string,
  preferred: (p: Pool) => boolean = () => false,
): Pool | undefined {
  const pairs = poolPairs(pools, version)
  const want = pair && pairs.includes(pair) ? pair : current && pairs.includes(pairOf(current)) ? pairOf(current) : pairs[0]
  const tiers = poolTiers(pools, version, want)
  if (!tiers.length) return undefined
  if (current) {
    const same = tiers.find((p) => p.feeBps === current.feeBps && p.network === current.network)
      || tiers.find((p) => p.feeBps === current.feeBps)
    if (same) return same
  }
  return tiers.find(preferred) || tiers[0]
}
