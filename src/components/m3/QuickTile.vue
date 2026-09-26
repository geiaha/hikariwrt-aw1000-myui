<script setup lang="ts">
import HkIcon from '@/components/icons/HkIcon.vue'
import type { IconName } from '@/components/icons/registry'

// Quick settings tile (Android-style): filled primary when on, container
// tone when off. A tile whose feature isn't set up is still a button: it
// takes you to where it can be set up.
withDefaults(
  defineProps<{ on: boolean; title: string; label: string; icon: IconName; busy?: boolean; compact?: boolean; toggle?: boolean }>(),
  { toggle: true },
)
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="hk-qt"
    :class="{ 'is-on': on, 'is-compact': compact }"
    :aria-pressed="toggle ? (on ? 'true' : 'false') : undefined"
    :aria-busy="busy ? 'true' : undefined"
    :disabled="busy"
    @click="$emit('click')"
  >
    <span class="hk-qt__chip">
      <v-progress-circular v-if="busy" indeterminate size="18" width="2" />
      <HkIcon v-else :name="icon" :size="20" />
    </span>
    <span class="hk-qt__text">
      <span class="hk-qt__title">{{ title }}</span>
      <span class="hk-qt__label">{{ label }}</span>
    </span>
  </button>
</template>

<style scoped>
.hk-qt {
  height: 76px;
  border-radius: 24px;
  border: 0;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  text-align: left;
  cursor: pointer;
  min-width: 0;
  transition: background-color 0.15s, color 0.15s;
}
.hk-qt.is-compact {
  height: 64px;
  border-radius: 32px;
  gap: 10px;
  padding: 0 12px;
}
.hk-qt:hover {
  filter: brightness(0.97);
}
.hk-qt.is-on {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hk-qt__chip {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-lowest));
  display: flex;
  align-items: center;
  justify-content: center;
}
.hk-qt.is-on .hk-qt__chip {
  background: rgba(255, 255, 255, 0.2);
}
.v-theme--dark .hk-qt.is-on .hk-qt__chip {
  background: rgba(0, 0, 0, 0.14);
}
.hk-qt__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.hk-qt__title {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hk-qt__label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hk-qt:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-qt:disabled {
  cursor: progress;
}
</style>
