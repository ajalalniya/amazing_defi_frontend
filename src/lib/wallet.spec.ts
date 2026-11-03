import { afterEach, describe, expect, it } from 'vitest'
import { chainLabel, getInjected, isInjectedAvailable, parseChainId, walletErrorMessage } from '@/lib/eip1193'
import { formatUnits, InjectedConnector, shortenAddress } from '@/lib/wallet'
import type { EthereumProvider } from '@/lib/eip1193'

function stub(partial: Partial<EthereumProvider>): EthereumProvider {
  return {
    request: async () => null,
    ...partial,
  }
}

describe('shortenAddress', () => {
  it('keeps the head and tail', () => {
    expect(shortenAddress('0x7A3f000000000000000000000000000000004C21')).toBe('0x7A3f…4C21')
  })
})

describe('chainLabel', () => {
  it('maps known ids', () => {
    expect(chainLabel(1)).toBe('Ethereum')
    expect(chainLabel(8453)).toBe('Base')
    expect(chainLabel(42161)).toBe('Arbitrum')
    expect(parseChainId('0xa4b1')).toBe(42161)
  })
})

describe('formatUnits', () => {
  it('scales 6 and 18 decimals', () => {
    expect(formatUnits(61_240_550000n, 6)).toBeCloseTo(61240.55)
    expect(formatUnits(10n * 10n ** 18n, 18)).toBe(10)
  })
})

describe('getInjected', () => {
  afterEach(() => {
    delete window.ethereum
    delete window.rabby
    delete window.coinbaseWalletExtension
  })

  it('does not treat Rabby as MetaMask', () => {
    window.ethereum = stub({ isMetaMask: true, isRabby: true })
    expect(getInjected('MetaMask')).toBeNull()
    expect(getInjected('Rabby')).toBe(window.ethereum)
  })

  it('picks MetaMask from a shared providers list', () => {
    const mm = stub({ isMetaMask: true })
    const rabby = stub({ isMetaMask: true, isRabby: true })
    window.ethereum = stub({ providers: [rabby, mm] })
    expect(getInjected('MetaMask')).toBe(mm)
    expect(getInjected('Rabby')).toBe(rabby)
    expect(isInjectedAvailable('Coinbase')).toBe(false)
  })

  it('does not invent a WalletConnect provider', () => {
    window.ethereum = stub({ isMetaMask: true })
    expect(getInjected('WalletConnect')).toBeNull()
  })
})

describe('InjectedConnector', () => {
  afterEach(() => {
    delete window.ethereum
  })

  it('requests accounts from the injected provider', async () => {
    const calls: string[] = []
    window.ethereum = stub({
      isMetaMask: true,
      request: async ({ method }) => {
        calls.push(method)
        if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111']
        if (method === 'eth_chainId') return '0x2105'
        return null
      },
    })
    const c = new InjectedConnector()
    const res = await c.connect('MetaMask')
    expect(calls[0]).toBe('eth_requestAccounts')
    expect(res.address).toBe('0x1111111111111111111111111111111111111111')
    expect(res.chain).toBe('Base')
    expect(res.chainId).toBe(8453)
  })

  it('refuses to connect when the extension is missing', async () => {
    const c = new InjectedConnector()
    await expect(c.connect('MetaMask')).rejects.toThrow(/not installed/i)
  })
})

describe('walletErrorMessage', () => {
  it('maps rejection codes', () => {
    expect(walletErrorMessage({ code: 4001 }, 'MetaMask')).toMatch(/rejected/i)
  })
})
