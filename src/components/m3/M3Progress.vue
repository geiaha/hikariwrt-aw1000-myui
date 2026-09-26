<script setup lang="ts">
import { computed } from 'vue'

// M3 (2024) linear progress: active part, a gap, the track, and a stop dot
// at the end of the track. `tone` switches to the error pair when a meter
// means trouble (a full drive).
const props = withDefaults(
  defineProps<{ value: number; label: string; tone?: 'primary' | 'error' | 'tertiary'; height?: number; stop?: boolean }>(),
  { tone: 'primary', height: 8, stop: true },
)
const pct = computed(() => Math.min(100, Math.max(0, Math.round(props.value))))
</script>

<template>
  <div
    class="hk-prog"
    :class="`is-${tone}`"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="pct"
    aria-valuemin="0"
    aria-valuemax="100"
    :style="{ height: `${height}px`, '--h': `${height}px` }"
  >
    <div v-if="pct > 0" class="hk-prog__fill" :style="{ width: `${pct}%` }" />
    <div v-if="pct < 100" class="hk-prog__track">
      <span v-if="stop" class="hk-prog__stop" />
    </div>
  </div>
</template>

<style scoped>
.hk-prog {
  display: flex;
  align-items: center;
  gap: 4px;
}
.hk-prog__fill {
  height: 100%;
  border-radius: calc(var(--h) / 2);
  background: rgb(var(--v-theme-primary));
  transition: width 0.3s;
}
.hk-prog__track {
  flex-grow: 1;
  height: 100%;
  border-radius: calc(var(--h) / 2);
  background: rgb(var(--v-theme-secondary-container));
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 2px;
  box-sizing: border-box;
}
.hk-prog__stop {
  width: 4px;
  height: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}
.is-error .hk-prog__fill,
.is-error .hk-prog__stop {
  background: rgb(var(--v-theme-error));
}
.is-error .hk-prog__track {
  background: rgb(var(--v-theme-error-container));
}
.is-tertiary .hk-prog__fill,
.is-tertiary .hk-prog__stop {
  background: rgb(var(--v-theme-tertiary));
}
.is-tertiary .hk-prog__track {
  background: rgb(var(--v-theme-tertiary-container));
}
</style>
