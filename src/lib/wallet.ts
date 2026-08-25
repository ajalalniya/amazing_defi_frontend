export type UnsignedTx = {
  to: string
  data: string
  value: string
  chainId: number
}

export type WalletKind = 'MetaMask' | 'Rabby' | 'WalletConnect' | 'Coinbase'

export interface WalletConnector {
  connect(kind: WalletKind): Promise<{ address: string; chain: string }>
  disconnect(): Promise<void>
  sendTransaction(tx: UnsignedTx): Promise<string>
}

const MOCK_BALANCES: Record<string, number> = {
  ETH: 8.412,
  USDC: 61_240.55,
  WBTC: 0.3841,
  ARB: 12_400.0,
  wstETH: 3.106,
  GMX: 180.4,
  LINK: 640.2,
  USDT: 8_200.1,
  PENDLE: 1_240,
  RDNT: 42_000,
}

export { MOCK_BALANCES }

/** Mock connector: no private keys, no RPC. A real EIP-1193 provider drops in later. */
export class MockConnector implements WalletConnector {
  async connect(_kind: WalletKind) {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase()
    return { address: `0x7A3f${hex}…4C21`, chain: 'Arbitrum' }
  }
  async disconnect() {}
  async sendTransaction(_tx: UnsignedTx): Promise<string> {
    return '0x' + Math.random().toString(16).slice(2).padEnd(64, '0')
  }
}

export const connector: WalletConnector = new MockConnector()
