import { onMounted, onUnmounted, watch } from 'vue'
import { wsUrl } from '@/api/client'
import type { PriceTick, Rollups } from '@/api/types'
import { useMarketsStore } from '@/stores/markets'
import { usePortfolioStore } from '@/stores/portfolio'
import { useWalletStore } from '@/stores/wallet'
import { useLiquidityStore } from '@/stores/liquidity'

export function usePriceFeed() {
  const markets = useMarketsStore()
  const portfolio = usePortfolioStore()
  const wallet = useWalletStore()
  const liquidity = useLiquidityStore()

  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let candleTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    if (closed) return
    const owner = wallet.address || 'demo'
    ws = new WebSocket(wsUrl(owner))
    ws.onopen = () => {
      attempt = 0
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type: string; data: unknown }
        if (msg.type === 'prices') {
          markets.patchPrices(msg.data as PriceTick[])
          scheduleCandleRefresh()
        } else if (msg.type === 'portfolio') {
          portfolio.applyRollups(msg.data as Rollups)
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = () => {
      ws = null
      if (closed) return
      const delay = Math.min(15_000, 500 * 2 ** attempt++)
      timer = setTimeout(connect, delay)
    }
    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleCandleRefresh() {
    if (liquidity.dragging) return
    if (candleTimer) return
    candleTimer = setTimeout(() => {
      candleTimer = null
      liquidity.fetchSeries()
    }, 400)
  }

  onMounted(connect)
  watch(() => wallet.address, () => {
    ws?.close()
  })
  onUnmounted(() => {
    closed = true
    if (timer) clearTimeout(timer)
    if (candleTimer) clearTimeout(candleTimer)
    ws?.close()
  })
}
