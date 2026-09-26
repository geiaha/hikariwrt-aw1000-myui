<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { avatarSlot, initial } from '@/utils/sms'

// Round avatar like Google Messages: an initial for named senders, a person
// for numbers, on one of four container colours picked from the name so
// the same correspondent always gets the same colour.
const props = withDefaults(defineProps<{ name: string; ckey: string; size?: number }>(), { size: 48 })
const SLOTS = ['primary', 'tertiary', 'info', 'success']
const slot = computed(() => SLOTS[avatarSlot(props.ckey)])
const letter = computed(() => initial(props.name))
</script>

<template>
  <span
    class="hk-avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${size * 0.42}px`,
      background: `rgb(var(--v-theme-${slot}-container))`,
      color: `rgb(var(--v-theme-on-${slot}-container))`,
    }"
    aria-hidden="true"
  >
    <template v-if="letter">{{ letter }}</template>
    <HkIcon v-else name="person" :size="size * 0.5" />
  </span>
</template>

<style scoped>
.hk-avatar {
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-family: var(--hk-display);
  font-weight: 500;
}
</style>
