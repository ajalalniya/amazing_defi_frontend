<script setup lang="ts">
defineProps<{
  options: { value: string; label: string; title?: string }[]
}>()
const model = defineModel<string | null>({ default: null })
</script>

<template>
  <div class="chips">
    <button
      v-for="o in options"
      :key="o.value"
      class="chip"
      :class="{ active: model === o.value }"
      :title="o.title"
      type="button"
      @click="model = o.value"
    >{{ o.label }}</button>
  </div>
</template>
