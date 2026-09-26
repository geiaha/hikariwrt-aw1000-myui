<script setup lang="ts">
import { computed } from 'vue'

// 270° gauge (RSRP on the Cellular page): filled arc, a gap, then the
// remaining track, like the M3 circular progress. `fraction` is 0..1.
const props = withDefaults(defineProps<{ fraction: number; size?: number; stroke?: number; label: string }>(), {
  size: 196,
  stroke: 16,
})

const R = 84
const ARC = 2 * Math.PI * R * 0.75 // 270°
const GAP = 8
const fill = computed(() => Math.max(0, Math.min(1, props.fraction)) * ARC)
const track = computed(() => Math.max(0, ARC - fill.value - (fill.value > 0 ? GAP : 0)))
</script>

<template>
  <div class="hk-gauge" :style="{ width: `${size}px`, height: `${size}px` }" role="meter" :aria-label="label" :aria-valuenow="Math.round(fraction * 100)" aria-valuemin="0" aria-valuemax="100">
    <svg :width="size" :height="size" viewBox="0 0 200 200" aria-hidden="true">
      <circle
        v-if="track > 0"
        cx="100" cy="100" :r="R" fill="none" class="track" :stroke-width="stroke" stroke-linecap="round"
        :stroke-dasharray="`${track} 1000`" :stroke-dashoffset="-(fill + (fill > 0 ? GAP : 0))" transform="rotate(135 100 100)"
      />
      <circle
        v-if="fill > 0"
        cx="100" cy="100" :r="R" fill="none" class="fill" :stroke-width="stroke" stroke-linecap="round"
        :stroke-dasharray="`${fill} 1000`" transform="rotate(135 100 100)"
      />
    </svg>
    <div class="hk-gauge__center"><slot /></div>
  </div>
</template>

<style scoped>
.hk-gauge {
  position: relative;
  flex-shrink: 0;
}
.hk-gauge svg {
  position: absolute;
  inset: 0;
}
.track {
  stroke: rgb(var(--v-theme-secondary-container));
}
.fill {
  stroke: rgb(var(--v-theme-primary));
  transition: stroke-dasharray 0.4s;
}
.hk-gauge__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
</style>
