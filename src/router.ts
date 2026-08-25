import { createRouter, createWebHistory } from 'vue-router'
import MarketsView from '@/views/MarketsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/markets' },
    { path: '/markets', component: MarketsView },
    { path: '/liquidity', component: () => import('@/views/LiquidityView.vue') },
    { path: '/trade', component: () => import('@/views/TradeView.vue') },
    { path: '/backtest', component: () => import('@/views/BacktestView.vue') },
    { path: '/positions', component: () => import('@/views/PositionsView.vue') },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
