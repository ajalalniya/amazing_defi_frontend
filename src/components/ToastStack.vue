<script setup lang="ts">
import { useToastStore } from '@/stores/toasts'
const toasts = useToastStore()
</script>

<template>
  <div class="toasts">
    <div v-for="t in toasts.items" :key="t.id" class="toast" :class="{ err: t.kind === 'err' }">
      <div class="bar" />
      <div>
        <div>{{ t.title }}</div>
        <small v-if="t.sub">{{ t.sub }}</small>
      </div>
    </div>
  </div>
</template>
