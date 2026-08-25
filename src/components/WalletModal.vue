<script setup lang="ts">
import { useWalletStore } from '@/stores/wallet'
import { useToastStore } from '@/stores/toasts'
import { usePortfolioStore } from '@/stores/portfolio'
import type { WalletKind } from '@/lib/wallet'
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

async function pick(kind: WalletKind) {
  await wallet.connect(kind)
  toasts.push('Wallet connected', `${kind} · ${wallet.chain} · ${fmtUsd(wallet.balances.USDC)} USDC`)
  await portfolio.load()
}

function close() {
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
        <button v-for="o in opts" :key="o.kind" class="wallet-opt" @click="pick(o.kind)">
          <span class="ic" :style="{ background: o.bg, color: o.color }">{{ o.ic }}</span>
          <span>{{ o.label }}<small>{{ o.sub }}</small></span>
        </button>
      </div>
    </div>
  </div>
</template>
