<script setup lang="ts">
import { onMounted } from 'vue'
import AppTopBar from '@/components/AppTopBar.vue'
import WalletModal from '@/components/WalletModal.vue'
import ToastStack from '@/components/ToastStack.vue'
import { useMarketsStore } from '@/stores/markets'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePriceFeed } from '@/composables/usePriceFeed'

const markets = useMarketsStore()
const portfolio = usePortfolioStore()
usePriceFeed()

onMounted(async () => {
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
