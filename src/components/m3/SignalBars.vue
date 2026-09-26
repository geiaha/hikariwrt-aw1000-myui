<script setup lang="ts">
// Five rising bars; `level` of them filled.
withDefaults(defineProps<{ level: number; height?: number }>(), { height: 40 })
const HEIGHTS = [30, 45, 62, 80, 100]
</script>

<template>
  <div class="hk-bars" :style="{ height: `${height}px` }" role="img" :aria-label="`Signal ${level} of 5`">
    <span v-for="(h, i) in HEIGHTS" :key="i" :class="{ on: i < level }" :style="{ height: `${h}%` }" />
  </div>
</template>

<style scoped>
.hk-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.hk-bars span {
  width: 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-outline-variant));
}
.hk-bars span.on {
  background: rgb(var(--v-theme-primary));
}
</style>
