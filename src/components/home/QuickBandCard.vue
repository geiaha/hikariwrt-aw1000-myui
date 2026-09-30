<script setup lang="ts">
import { ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import BandLockCard from '@/components/cellular/BandLockCard.vue'
import type { LockInfo } from '@/api/modem'

// Home's quick band lock, for a "5G router": the 5G and LTE band chips of the
// Cellular page in one card, one group at a time. Cell locks and network mode
// stay on the Cellular page, linked from here.
defineProps<{ lock: LockInfo | null }>()
const emit = defineEmits<{ applied: [] }>()
const group = ref<'nr' | 'lte'>('nr')
</script>

<template>
  <section class="hk-card" aria-label="Band lock" style="gap: 14px">
    <div class="d-flex align-center">
      <h2 class="hk-h2 flex-grow-1">Band lock</h2>
      <router-link :to="{ path: '/cellular', query: { tab: 'lock' } }" class="hk-link" style="margin: 0 -12px 0 0">More <HkIcon name="arrowRight" :size="18" /></router-link>
    </div>
    <SegmentedButton
      v-model="group"
      label="Band group"
      :options="[
        { value: 'nr', label: '5G' },
        { value: 'lte', label: 'LTE' },
      ]"
    />
    <BandLockCard :key="group" :lock="lock" :group="group" embedded @applied="emit('applied')" />
  </section>
</template>
