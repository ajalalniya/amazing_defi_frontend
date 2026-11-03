<script setup lang="ts">
import { onMounted } from 'vue'
import AppTopBar from '@/components/AppTopBar.vue'
import WalletModal from '@/components/WalletModal.vue'
import ToastStack from '@/components/ToastStack.vue'
import { useMarketsStore } from '@/stores/markets'
import { usePortfolioStore } from '@/stores/portfolio'
import { useSessionStore } from '@/stores/session'
import { usePriceFeed } from '@/composables/usePriceFeed'

const session = useSessionStore()
const markets = useMarketsStore()
const portfolio = usePortfolioStore()
usePriceFeed()

onMounted(async () => {
  await session.load()
  await markets.load()
  await portfolio.load()
})
</script>

<template>
  <AppTopBar />
  <main>
    <router-view />
  </main>
  <WalletModal />
  <ToastStack />
</template>
