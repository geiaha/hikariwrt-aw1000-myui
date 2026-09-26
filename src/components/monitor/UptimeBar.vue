<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BucketState } from '@/api/monitor'
import { bucketTime, ms, pct, type Bar } from '@/utils/series'

// UniFi-style uptime bar: one rounded segment per bucket, coloured up /
// degraded / down / no data, with a tooltip for the segment under the
// pointer (or finger).
const props = defineProps<{ bar: Bar; from: number; label: string }>()

const NAMES: Record<BucketState, string> = { 0: 'No data', 1: 'Up', 2: 'Degraded', 3: 'Down' }
const hover = ref<number | null>(null)
const row = ref<HTMLElement | null>(null)
const left = ref(0)

function onMove(e: PointerEvent): void {
  const seg = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
  if (!seg || !row.value) {
    hover.value = null
    return
  }
  hover.value = Number(seg.dataset.i)
  const r = row.value.getBoundingClientRect()
  const s = seg.getBoundingClientRect()
  left.value = Math.max(0, Math.min(s.left - r.left + s.width / 2 - 90, r.width - 180))
}

const tip = computed(() => {
  const i = hover.value
  if (i == null) return null
  const st = props.bar.state[i]
  return { time: bucketTime(props.bar.ts[i], props.bar.step), st, name: NAMES[st], rtt: props.bar.rtt[i], loss: props.bar.loss[i] }
})
</script>

<template>
  <div class="hk-ub">
    <div ref="row" class="hk-ub__row" role="img" :aria-label="label" @pointermove="onMove" @pointerdown="onMove" @pointerleave="hover = null">
      <div v-for="(s, i) in bar.state" :key="i" :data-i="i" class="hk-ub__seg" :class="[`is-${s}`, { 'is-hot': hover === i }]" />
    </div>
    <div class="hk-ub__ends hk-label">
      <span>{{ bar.ts.length ? bucketTime(from) : '' }}</span>
      <span>Now</span>
    </div>
    <div v-if="tip" class="hk-ub__tip" :style="{ left: `${left}px` }" role="status">
      <div class="hk-label">{{ tip.time }}</div>
      <div class="hk-ub__line"><span class="hk-ub__key" :class="`is-${tip.st}`" />{{ tip.name }}</div>
      <template v-if="tip.st">
        <div class="hk-ub__line">Latency <b>{{ ms(tip.rtt) }}</b></div>
        <div class="hk-ub__line">Packet loss <b>{{ pct(tip.loss) }}</b></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hk-ub {
  position: relative;
}
.hk-ub__row {
  display: flex;
  gap: 2px;
  height: 32px;
  touch-action: pan-y;
}
.hk-ub__seg {
  flex: 1 1 0;
  min-width: 1px;
  border-radius: 3px;
  background: rgb(var(--v-theme-surface-container-highest));
  transition: transform 0.1s;
}
.hk-ub__seg.is-1,
.hk-ub__key.is-1 {
  background: rgb(var(--v-theme-success));
}
.hk-ub__seg.is-2,
.hk-ub__key.is-2 {
  background: rgb(var(--v-theme-warning));
}
.hk-ub__seg.is-3,
.hk-ub__key.is-3 {
  background: rgb(var(--v-theme-error));
}
.hk-ub__seg.is-hot {
  transform: scaleY(1.15);
}
.hk-ub__ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
.hk-ub__tip {
  position: absolute;
  top: 40px;
  z-index: 2;
  width: 180px;
  pointer-events: none;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 12px;
  line-height: 18px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
.hk-ub__tip .hk-label {
  color: inherit;
  opacity: 0.75;
}
.hk-ub__line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hk-ub__line b {
  margin-left: auto;
  font-weight: 600;
}
.hk-ub__key {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: rgb(var(--v-theme-surface-container-highest));
}
</style>
