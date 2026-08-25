<script setup lang="ts">
import { tokenColor } from '@/lib/tokens'

defineProps<{
  a: string
  b: string
  name: string
  meta?: string
}>()
</script>

<template>
  <div class="pair">
    <div class="coins">
      <div class="coin" :style="{ background: tokenColor(a) }">{{ a.slice(0, 3).toUpperCase() }}</div>
      <div class="coin" :style="{ background: tokenColor(b) }">{{ b.slice(0, 3).toUpperCase() }}</div>
    </div>
    <div>
      <div class="nm">{{ name }}</div>
      <div class="mt">{{ meta }}</div>
    </div>
  </div>
</template>
