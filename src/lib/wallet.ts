import {
  chainLabel,
  getInjected,
  parseChainId,
  type EthereumProvider,
  type WalletKind,
} from './eip1193'

export type { WalletKind }
export { isInjectedAvailable, walletErrorMessage } from './eip1193'

export type UnsignedTx = {
  to: string
  data: string
  value: string
  chainId: number
}

export type ConnectedWallet = {
  address: string
  chain: string
  chainId: number
}

export type WalletHandlers = {
  onAccountsChanged?: (address: string | null) => void
  onChainChanged?: (chainId: number, chain: string) => void
}

export interface WalletConnector {
  connect(kind: WalletKind): Promise<ConnectedWallet>
  disconnect(): Promise<void>
  sendTransaction(tx: UnsignedTx): Promise<string>
  getBalances(address: string, chainId: number): Promise<Record<string, number>>
  setHandlers(handlers: WalletHandlers): void
}

export function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const ZERO_BALANCES: Record<string, number> = {
  ETH: 0,
  USDC: 0,
  WBTC: 0,
  ARB: 0,
  wstETH: 0,
  GMX: 0,
  LINK: 0,
  USDT: 0,
  PENDLE: 0,
  RDNT: 0,
}

export function emptyBalances(): Record<string, number> {
  return { ...ZERO_BALANCES }
}

type TokenSpec = { symbol: string; address: string; decimals: number }

const TOKENS: Record<number, TokenSpec[]> = {
  1: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
    { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
    { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18 },
  ],
  8453: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'wstETH', address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', decimals: 18 },
  ],
  42161: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'WBTC', address: '0x2f2a2543B76A807366cd43C7eA4C0C2a36e7dcc1', decimals: 8 },
    { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
    { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18 },
    { symbol: 'LINK', address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18 },
    { symbol: 'wstETH', address: '0x5979D7b546E38E414F7E9822514be443A4800529', decimals: 18 },
  ],
}

function hexToBigInt(hex: string): bigint {
  const s = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (!s) return 0n
  return BigInt('0x' + s)
}

export function formatUnits(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = raw % base
  return Number(whole) + Number(frac) / Number(base)
}

function padAddress(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0')
}

/** Injected EIP-1193 connector. Does not invent accounts — the wallet must approve. */
export class InjectedConnector implements WalletConnector {
  private provider: EthereumProvider | null = null
  private from: string | null = null
  private handlers: WalletHandlers = {}
  private accountsHandler = (accounts: unknown) => {
    const list = Array.isArray(accounts) ? (accounts as string[]) : []
    const next = list[0] || null
    this.from = next
    this.handlers.onAccountsChanged?.(next)
  }
  private chainHandler = (hex: unknown) => {
    const id = parseChainId(String(hex || '0x0'))
    this.handlers.onChainChanged?.(id, chainLabel(id))
  }

  setHandlers(handlers: WalletHandlers) {
    this.handlers = handlers
  }

  async connect(kind: WalletKind): Promise<ConnectedWallet> {
    if (kind === 'WalletConnect') {
      throw new Error('WalletConnect is not wired yet. Use MetaMask, Rabby, or Coinbase.')
    }
    const provider = getInjected(kind)
    if (!provider) {
      throw new Error(`${kind} is not installed. Install the browser extension and refresh.`)
    }
    this.unbind()
    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    const address = accounts?.[0]
    if (!address) {
      throw new Error('No account returned from the wallet')
    }
    const chainHex = String(await provider.request({ method: 'eth_chainId' }))
    const chainId = parseChainId(chainHex)
    this.provider = provider
    this.from = address
    this.bind(provider)
    return { address, chain: chainLabel(chainId), chainId }
  }

  async disconnect(): Promise<void> {
    const provider = this.provider
    this.unbind()
    this.provider = null
    this.from = null
    if (!provider) return
    try {
      await provider.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      })
    } catch {
      /* not all wallets support revoke */
    }
  }

  async sendTransaction(tx: UnsignedTx): Promise<string> {
    if (!this.provider || !this.from) {
      throw new Error('Connect a wallet first')
    }
    const hash = await this.provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: this.from,
          to: tx.to,
          data: tx.data,
          value: tx.value || '0x0',
          chainId: '0x' + tx.chainId.toString(16),
        },
      ],
    })
    return String(hash)
  }

  async getBalances(address: string, chainId: number): Promise<Record<string, number>> {
    const out = emptyBalances()
    if (!this.provider || !address) return out
    try {
      const raw = String(await this.provider.request({ method: 'eth_getBalance', params: [address, 'latest'] }))
      out.ETH = formatUnits(hexToBigInt(raw), 18)
    } catch {
      /* keep 0 */
    }
    const tokens = TOKENS[chainId] || []
    await Promise.all(
      tokens.map(async (t) => {
        try {
          const data = '0x70a08231' + padAddress(address)
          const raw = String(
            await this.provider!.request({
              method: 'eth_call',
              params: [{ to: t.address, data }, 'latest'],
            }),
          )
          out[t.symbol] = formatUnits(hexToBigInt(raw), t.decimals)
        } catch {
          /* keep 0 */
        }
      }),
    )
    return out
  }

  private bind(provider: EthereumProvider) {
    provider.on?.('accountsChanged', this.accountsHandler)
    provider.on?.('chainChanged', this.chainHandler)
  }

  private unbind() {
    this.provider?.removeListener?.('accountsChanged', this.accountsHandler)
    this.provider?.removeListener?.('chainChanged', this.chainHandler)
  }
}

export const connector: WalletConnector = new InjectedConnector()
