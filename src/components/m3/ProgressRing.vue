<script setup lang="ts">
import { computed } from 'vue'

// Full-circle M3 progress ring with a gap (data used this month).
const props = withDefaults(defineProps<{ value: number; size?: number; stroke?: number; label: string }>(), {
  size: 104,
  stroke: 10,
})
const R = 44
const C = 2 * Math.PI * R
const GAP = 5
const fill = computed(() => (Math.max(0, Math.min(100, props.value)) / 100) * C)
const track = computed(() => Math.max(0, C - fill.value - (fill.value > 0 ? GAP * 2 : 0)))
</script>

<template>
  <div class="hk-ring" :style="{ width: `${size}px`, height: `${size}px` }" role="progressbar" :aria-label="label" :aria-valuenow="Math.round(value)" aria-valuemin="0" aria-valuemax="100">
    <svg :width="size" :height="size" viewBox="0 0 104 104" aria-hidden="true">
      <circle
        v-if="track > 0" cx="52" cy="52" :r="R" fill="none" class="track" :stroke-width="stroke" stroke-linecap="round"
        :stroke-dasharray="`${track} 1000`" :stroke-dashoffset="-(fill + (fill > 0 ? GAP : 0))" transform="rotate(-90 52 52)"
      />
      <circle
        v-if="fill > 0" cx="52" cy="52" :r="R" fill="none" class="fill" :stroke-width="stroke" stroke-linecap="round"
        :stroke-dasharray="`${fill} 1000`" transform="rotate(-90 52 52)"
      />
    </svg>
    <div class="hk-ring__center"><slot /></div>
  </div>
</template>

<style scoped>
.hk-ring {
  position: relative;
  flex-shrink: 0;
}
.hk-ring svg {
  position: absolute;
  inset: 0;
}
.track {
  stroke: rgb(var(--v-theme-secondary-container));
}
.fill {
  stroke: rgb(var(--v-theme-primary));
}
.hk-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
