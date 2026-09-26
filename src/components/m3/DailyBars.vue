<script setup lang="ts">
import { computed } from 'vue'
import { bytes } from '@/utils/format'

// Daily usage as stacked rounded bars (download in primary, upload in
// tertiary). Plain SVG: no chart library for one small chart. Each bar is a
// focusable element with its numbers in the accessible name.
const props = defineProps<{ days: { date: string; rx: number; tx: number }[]; height?: number }>()

const H = computed(() => props.height ?? 160)
const max = computed(() => Math.max(1, ...props.days.map((d) => d.rx + d.tx)))
const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
</script>

<template>
  <div class="hk-bars2" :style="{ height: `${H + 24}px` }">
    <div
      v-for="d in days"
      :key="d.date"
      class="hk-bars2__col"
      tabindex="0"
      :aria-label="`${label(d.date)}: ${bytes(d.rx)} down, ${bytes(d.tx)} up`"
      :title="`${label(d.date)} · ${bytes(d.rx)} ↓ · ${bytes(d.tx)} ↑`"
    >
      <div class="hk-bars2__stack" :style="{ height: `${H}px` }">
        <div class="tx" :style="{ height: `${(d.tx / max) * H}px` }" />
        <div class="rx" :style="{ height: `${(d.rx / max) * H}px` }" />
      </div>
      <span class="hk-bars2__day">{{ new Date(`${d.date}T00:00:00`).getDate() }}</span>
    </div>
  </div>
</template>

<style scoped>
.hk-bars2 {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  overflow-x: auto;
}
.hk-bars2__col {
  flex: 1 0 14px;
  max-width: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  outline: none;
}
.hk-bars2__col:focus-visible {
  outline: 2px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-bars2__stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
  background: rgb(var(--v-theme-surface-container-lowest));
  border-radius: 6px;
}
.hk-bars2__stack > div {
  border-radius: 6px;
  min-height: 0;
}
.rx {
  background: rgb(var(--v-theme-primary));
}
.tx {
  background: rgb(var(--v-theme-tertiary));
}
.hk-bars2__day {
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-muted));
}
</style>
