<script setup lang="ts">
const props = defineProps<{ version: string; hook?: string }>()
const label = () => {
  if (props.version === 'gmx') return 'GMX'
  if (props.version === 'v3') return 'Uniswap v3'
  return props.hook ? `Uniswap v4 · ${props.hook}` : 'Uniswap v4'
}
</script>

<template>
  <span class="badge" :class="version === 'gmx' ? 'gmx' : version">{{ label() }}</span>
</template>
