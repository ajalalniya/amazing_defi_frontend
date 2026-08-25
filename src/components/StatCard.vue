<script setup lang="ts">
defineProps<{
  label: string
  value: string
  sub?: string
  tone?: string
}>()
</script>

<template>
  <div class="card stat">
    <div class="k">{{ label }}</div>
    <div class="v" :class="tone">{{ value }}</div>
    <div class="d" :class="tone === 'pos' || tone === 'neg' ? tone : ''">{{ sub }}</div>
  </div>
</template>
