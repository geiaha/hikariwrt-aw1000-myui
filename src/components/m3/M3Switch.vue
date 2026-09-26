<script setup lang="ts">
import HkIcon from '@/components/icons/HkIcon.vue'

// M3 switch as drawn on the canvas: 52x32 track, 24px thumb with a check
// when on, 16px outlined thumb when off. `busy` shows the change is being
// applied and blocks double toggles.
defineProps<{ modelValue: boolean; label: string; disabled?: boolean; busy?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="hk-switch"
    :class="{ 'is-on': modelValue, 'is-busy': busy }"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-label="label"
    :aria-busy="busy ? 'true' : undefined"
    :disabled="disabled || busy"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="hk-switch__thumb">
      <v-progress-circular v-if="busy" indeterminate size="14" width="2" />
      <HkIcon v-else-if="modelValue" name="check" :size="16" />
    </span>
  </button>
</template>

<style scoped>
.hk-switch {
  width: 52px;
  height: 32px;
  flex-shrink: 0;
  box-sizing: border-box;
  border-radius: 16px;
  border: 2px solid rgb(var(--v-theme-outline));
  background: rgb(var(--v-theme-surface-container-highest));
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.hk-switch__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  color: rgb(var(--v-theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.15s, height 0.15s;
}
.hk-switch.is-on {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  padding: 0 2px;
  justify-content: flex-end;
}
.hk-switch.is-on .hk-switch__thumb {
  width: 24px;
  height: 24px;
  background: rgb(var(--v-theme-on-primary));
}
.hk-switch.is-busy .hk-switch__thumb {
  width: 24px;
  height: 24px;
}
.hk-switch:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-switch:disabled {
  cursor: default;
}
.hk-switch:disabled:not(.is-busy) {
  opacity: 0.38;
}
</style>
