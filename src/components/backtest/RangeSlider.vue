<script setup lang="ts">
import { computed } from 'vue'

// Two handles on one track: the low and high edge of an LP range, as percent
// from a reference price. Built from two overlaid range inputs so each handle
// keeps native keyboard and touch support; only the thumbs take pointer
// events, so a press lands on whichever handle is under it.
const props = withDefaults(defineProps<{ lo: number; hi: number; min: number; max: number; step?: number }>(), { step: 0.5 })
const emit = defineEmits<{ change: [lo: number, hi: number] }>()

const pos = (v: number) => ((Math.min(Math.max(v, props.min), props.max) - props.min) / (props.max - props.min)) * 100
const fill = computed(() => ({ left: pos(props.lo) + '%', width: Math.max(0, pos(props.hi) - pos(props.lo)) + '%' }))
const zero = computed(() => (props.min < 0 && props.max > 0 ? pos(0) + '%' : null))

function onLo(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  const lo = Math.min(v, props.hi - props.step)
  ;(e.target as HTMLInputElement).value = String(lo)
  emit('change', lo, props.hi)
}
function onHi(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  const hi = Math.max(v, props.lo + props.step)
  ;(e.target as HTMLInputElement).value = String(hi)
  emit('change', props.lo, hi)
}
</script>

<template>
  <div class="rs">
    <div class="track" />
    <div class="fill" :style="fill" />
    <div v-if="zero" class="zero" :style="{ left: zero }" />
    <input
      type="range" class="thumb lo" aria-label="Range low edge, percent from reference price"
      :min="min" :max="max" :step="step" :value="lo" @input="onLo"
    />
    <input
      type="range" class="thumb hi" aria-label="Range high edge, percent from reference price"
      :min="min" :max="max" :step="step" :value="hi" @input="onHi"
    />
  </div>
</template>

<style scoped>
.rs { position: relative; height: 26px; }
.track, .fill {
  position: absolute; top: 50%; height: 4px; margin-top: -2px; border-radius: 2px;
}
.track { left: 0; right: 0; background: var(--line); }
.fill { background: var(--gmx); opacity: .75; }
.zero { position: absolute; top: 4px; bottom: 4px; width: 2px; margin-left: -1px; background: var(--txt-faint); border-radius: 1px; }
.thumb {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0;
  background: none; pointer-events: none; appearance: none; -webkit-appearance: none; border: 0;
}
/* The app's focus ring would outline the whole track; the focused handle gets
   its own ring below instead. */
.thumb:focus, .thumb:focus-visible { outline: none; box-shadow: none; }
.thumb::-webkit-slider-runnable-track { background: none; border: 0; }
.thumb::-moz-range-track { background: none; border: 0; }
.thumb::-webkit-slider-thumb {
  pointer-events: auto; -webkit-appearance: none; appearance: none; cursor: grab;
  width: 16px; height: 16px; border-radius: 50%; background: var(--txt); border: 3px solid var(--gmx);
  box-shadow: 0 0 0 3px var(--bg-elev);
}
.thumb::-moz-range-thumb {
  pointer-events: auto; cursor: grab;
  width: 10px; height: 10px; border-radius: 50%; background: var(--txt); border: 3px solid var(--gmx);
  box-shadow: 0 0 0 3px var(--bg-elev);
}
.thumb:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--bg-elev), 0 0 0 5px var(--gmx); }
.thumb:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px var(--bg-elev), 0 0 0 5px var(--gmx); }
.thumb:active::-webkit-slider-thumb { cursor: grabbing; }
</style>
