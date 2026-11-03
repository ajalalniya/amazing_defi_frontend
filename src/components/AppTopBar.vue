<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWalletStore } from '@/stores/wallet'
import { usePortfolioStore } from '@/stores/portfolio'
import { useToastStore } from '@/stores/toasts'
import { useSessionStore } from '@/stores/session'
import { cls, fmtSigned } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const wallet = useWalletStore()
const portfolio = usePortfolioStore()
const toasts = useToastStore()
const session = useSessionStore()

const tabs = [
  { to: '/markets', label: 'Markets' },
  { to: '/liquidity', label: 'Add Liquidity' },
  { to: '/trade', label: 'Long / Short' },
  { to: '/backtest', label: 'Backtest' },
  { to: '/positions', label: 'Positions' },
]

const pnl = computed(() => portfolio.rollups?.total)
const pnlText = computed(() => (wallet.connected && pnl.value != null ? fmtSigned(pnl.value) : '—'))
const pnlCls = computed(() => (wallet.connected && pnl.value != null ? cls(pnl.value) : 'dim'))

function onWallet() {
  if (wallet.connected) {
    const name = wallet.wallet
    wallet.disconnect()
    toasts.push('Wallet disconnected', name || undefined)
  } else {
    wallet.modalOpen = true
  }
}

function go(to: string) {
  router.push(to)
}
</script>

<template>
  <div class="topbar">
    <div class="brand">
      <div class="mark">A</div>
      <div>Amazing <small>terminal</small></div>
    </div>
    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.to"
        :class="{ active: route.path === t.to }"
        @click="go(t.to)"
      >{{ t.label }}</button>
    </nav>
    <div class="spacer" />
    <div
      class="pill"
      :class="{
        'mode-mock': session.provider === 'mock',
        'mode-chain': session.provider === 'chain',
        'mode-down': !session.provider,
      }"
      :title="session.hint"
    >{{ session.label }}</div>
    <div class="pill" title="Aggregate unrealised P/L across Uniswap v3, v4 and GMX">
      Total P/L <b :class="pnlCls">{{ pnlText }}</b>
    </div>
    <div v-if="wallet.connected" class="pill"><span class="dot" /> {{ wallet.chain }}</div>
    <button class="btn" :class="wallet.connected ? '' : 'primary'" @click="onWallet">
      {{ wallet.connected ? wallet.shortAddress : 'Connect Wallet' }}
    </button>
  </div>
</template>
