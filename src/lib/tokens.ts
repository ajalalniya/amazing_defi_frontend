export const TOKEN_COLORS: Record<string, string> = {
  ETH: '#8a92f5',
  USDC: '#3f8ff0',
  WBTC: '#f7931a',
  ARB: '#4fa9ff',
  GMX: '#5b8def',
  USDT: '#39c17f',
  BTC: '#f7931a',
  USD: '#3f8ff0',
  LINK: '#4a7cf7',
  PENDLE: '#4dd6c0',
  wstETH: '#7ba7f0',
  RDNT: '#c07df5',
}

export function tokenColor(sym: string): string {
  return TOKEN_COLORS[sym] || '#666'
}
