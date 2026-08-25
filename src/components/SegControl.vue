<script setup lang="ts">
defineProps<{
  options: { value: string; label: string; side?: string }[]
  dense?: boolean
  lg?: boolean
}>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="seg" :class="{ dense, lg }">
    <button
      v-for="o in options"
      :key="o.value"
      :class="{ active: model === o.value }"
      :data-side="o.side"
      type="button"
      @click="model = o.value"
    >{{ o.label }}</button>
  </div>
</template>
