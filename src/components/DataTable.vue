<script setup lang="ts">
defineProps<{ empty?: string }>()
</script>

<template>
  <div class="table-wrap">
    <table>
      <slot />
    </table>
  </div>
</template>
