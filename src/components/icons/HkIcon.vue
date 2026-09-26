<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconDef, type IconName } from './registry'

// Decorative by default (aria-hidden); pass `label` when the icon is the
// only thing saying what something is.
const props = withDefaults(defineProps<{ name: IconName; size?: number | string; stroke?: number; label?: string }>(), {
  size: 22,
})

const def = computed<IconDef>(() => ICONS[props.name])
</script>

<template>
  <svg
    class="hk-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="def.fill ? 'currentColor' : 'none'"
    stroke="currentColor"
    :stroke-width="stroke ?? def.stroke ?? 2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    v-html="def.body"
  />
</template>

<style scoped>
.hk-icon {
  display: block;
  flex: none;
}
</style>
