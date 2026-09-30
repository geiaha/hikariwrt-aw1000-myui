<script setup lang="ts">
import BandLockCard from '@/components/cellular/BandLockCard.vue'
import CellLockCard from '@/components/cellular/CellLockCard.vue'
import NetworkModeCard from '@/components/cellular/NetworkModeCard.vue'
import type { LockInfo } from '@/api/modem'

// Network mode, band locks (5G, LTE) and cell lock. Writes answer with a
// fresh lock reply; the parent keeps it so the overview stays in step.
/** home: the PLMN the modem is registered on, to leave other operators' cells out. */
defineProps<{ lock: LockInfo | null; home: string | null }>()
const emit = defineEmits<{ state: [state?: LockInfo] }>()
</script>

<template>
  <div class="hk-lock">
    <div class="d-flex flex-column ga-4" style="min-width: 0">
      <CellLockCard :lock="lock" :home="home" @changed="emit('state', $event)" />
    </div>
    <div class="d-flex flex-column ga-4" style="min-width: 0">
      <NetworkModeCard :lock="lock" @applied="emit('state', $event)" />
      <BandLockCard :lock="lock" group="nr" @applied="emit('state')" />
      <BandLockCard :lock="lock" group="lte" @applied="emit('state')" />
    </div>
  </div>
</template>

<style scoped>
.hk-lock {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 1279.98px) {
  .hk-lock {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
