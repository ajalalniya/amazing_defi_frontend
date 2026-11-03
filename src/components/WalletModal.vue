<script setup lang="ts">
import { computed } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useToastStore } from '@/stores/toasts'
import { usePortfolioStore } from '@/stores/portfolio'
import { isInjectedAvailable, walletErrorMessage, type WalletKind } from '@/lib/wallet'
import { fmtUsd } from '@/lib/format'

const wallet = useWalletStore()
const toasts = useToastStore()
const portfolio = usePortfolioStore()

const opts: { kind: WalletKind; label: string; sub: string; bg: string; color: string; ic: string }[] = [
  { kind: 'MetaMask', label: 'MetaMask', sub: 'Browser extension', bg: '#f6851b22', color: '#f6851b', ic: '🦊' },
  { kind: 'Rabby', label: 'Rabby', sub: 'Browser extension', bg: '#7084ff22', color: '#7084ff', ic: '🐰' },
  { kind: 'WalletConnect', label: 'WalletConnect', sub: 'Scan with a mobile wallet', bg: '#3b99fc22', color: '#3b99fc', ic: '◎' },
  { kind: 'Coinbase', label: 'Coinbase Wallet', sub: 'Extension or mobile', bg: '#0052ff22', color: '#4d8dff', ic: '◉' },
]

const availability = computed(() => {
  void wallet.modalOpen
  return {
    MetaMask: isInjectedAvailable('MetaMask'),
    Rabby: isInjectedAvailable('Rabby'),
    Coinbase: isInjectedAvailable('Coinbase'),
    WalletConnect: false,
  }
})

function subFor(kind: WalletKind, fallback: string) {
  if (kind === 'WalletConnect') return 'Not wired yet'
  return availability.value[kind] ? fallback : 'Not installed'
}

async function pick(kind: WalletKind) {
  if (wallet.connecting) return
  try {
    await wallet.connect(kind)
    const usdc = wallet.balances.USDC
    const extra = usdc > 0 ? ` · ${fmtUsd(usdc)} USDC` : ''
    toasts.push('Wallet connected', `${kind} · ${wallet.chain}${extra}`)
    await portfolio.load()
  } catch (e) {
    toasts.push('Could not connect', walletErrorMessage(e, kind), 'err')
  }
}

function close() {
  if (wallet.connecting) return
  wallet.modalOpen = false
}
</script>

<template>
  <div class="backdrop" :class="{ open: wallet.modalOpen }" @click.self="close">
    <div class="modal">
      <header>
        <h3>Connect a wallet</h3>
        <button class="icon-btn" aria-label="Close" @click="close">×</button>
      </header>
      <div class="body">
        <button
          v-for="o in opts"
          :key="o.kind"
          class="wallet-opt"
          :class="{ missing: !availability[o.kind] }"
          :disabled="wallet.connecting"
          @click="pick(o.kind)"
        >
          <span class="ic" :style="{ background: o.bg, color: o.color }">{{ o.ic }}</span>
          <span>{{ o.label }}<small>{{ subFor(o.kind, o.sub) }}</small></span>
        </button>
      </div>
    </div>
  </div>
</template>
