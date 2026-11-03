export type WalletKind = 'MetaMask' | 'Rabby' | 'WalletConnect' | 'Coinbase'

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  providers?: EthereumProvider[]
  isMetaMask?: boolean
  isRabby?: boolean
  isCoinbaseWallet?: boolean
  isCoinbaseBrowser?: boolean
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
    rabby?: EthereumProvider
    coinbaseWalletExtension?: EthereumProvider
  }
}

export function injectedProviders(): EthereumProvider[] {
  if (typeof window === 'undefined') return []
  const out: EthereumProvider[] = []
  const add = (p?: EthereumProvider) => {
    if (p && !out.includes(p)) out.push(p)
  }
  const eth = window.ethereum
  if (eth?.providers?.length) {
    for (const p of eth.providers) add(p)
  }
  add(eth)
  add(window.rabby)
  add(window.coinbaseWalletExtension)
  return out
}

export function getInjected(kind: WalletKind): EthereumProvider | null {
  const list = injectedProviders()
  const find = (pred: (p: EthereumProvider) => boolean) => list.find(pred) ?? null
  switch (kind) {
    case 'MetaMask':
      return (
        find((p) => !!p.isMetaMask && !p.isRabby && !p.isCoinbaseWallet && !p.isCoinbaseBrowser) ||
        find((p) => !!p.isMetaMask && !p.isRabby)
      )
    case 'Rabby':
      return find((p) => !!p.isRabby) || window.rabby || null
    case 'Coinbase':
      return (
        find((p) => !!p.isCoinbaseWallet || !!p.isCoinbaseBrowser) ||
        window.coinbaseWalletExtension ||
        null
      )
    case 'WalletConnect':
      return null
  }
}

export function isInjectedAvailable(kind: WalletKind): boolean {
  return getInjected(kind) != null
}

export function chainLabel(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum'
    case 56:
      return 'BNB Chain'
    case 8453:
      return 'Base'
    case 42161:
      return 'Arbitrum'
    default:
      return `Chain ${chainId}`
  }
}

export function parseChainId(hex: string): number {
  const n = Number.parseInt(hex, 16)
  return Number.isFinite(n) ? n : 0
}

export function walletErrorMessage(err: unknown, kind: WalletKind): string {
  const e = err as { code?: number; message?: string }
  if (e?.code === 4001) return 'Request rejected in the wallet'
  if (e?.code === -32002) return `Open ${kind} — a connection request is already pending`
  const msg = (e?.message || '').toLowerCase()
  if (msg.includes('not installed') || msg.includes('no provider')) {
    return `${kind} is not installed. Install the extension and refresh.`
  }
  return e?.message || `Could not connect ${kind}`
}
