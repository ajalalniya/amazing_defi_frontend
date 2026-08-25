<script setup lang="ts">
defineProps<{
  efficiency: string
  apr: string
  width: string
  tir: string
  held: string
  histLbl: string
}>()
</script>

<template>
  <div class="kpi-strip">
    <div><div class="k">Capital efficiency</div><div class="v">{{ efficiency }}</div></div>
    <div><div class="k">Fee APR in range</div><div class="v pos">{{ apr }}</div></div>
    <div><div class="k">Range width</div><div class="v">{{ width }}</div></div>
    <div><div class="k">Est. time in range</div><div class="v">{{ tir }}</div></div>
    <div><div class="k">Held in range {{ histLbl }}</div><div class="v">{{ held }}</div></div>
  </div>
</template>
