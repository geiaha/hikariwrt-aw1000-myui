<script setup lang="ts">
import { ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { ModemStatus } from '@/api/modem'
import { maskIccid } from '@/utils/cellular'

defineProps<{ modem: ModemStatus | null }>()
// The ICCID is masked by default (it identifies the SIM to the carrier);
// a tap shows it in full.
const reveal = ref(false)
</script>

<template>
  <section class="hk-card" aria-label="SIM" style="gap: 14px">
    <div class="d-flex align-center ga-2">
      <h2 class="hk-h2 flex-grow-1">SIM</h2>
      <template v-if="modem">
        <span v-if="modem.sim === 'ready'" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />Ready</span>
        <span v-else class="hk-chip hk-chip--error">{{ modem.sim }}</span>
      </template>
    </div>
    <dl v-if="modem" class="hk-group hk-sim">
      <div><dt>Number</dt><dd>{{ modem.identity?.msisdn || 'Not stored on SIM' }}</dd></div>
      <div>
        <dt>ICCID</dt>
        <dd>
          <button type="button" class="hk-reveal" :aria-label="reveal ? 'Hide ICCID' : 'Show ICCID'" @click="reveal = !reveal">
            {{ reveal ? modem.identity?.iccid : maskIccid(modem.identity?.iccid) }}
          </button>
        </dd>
      </div>
      <div><dt>IMEI</dt><dd>{{ modem.identity?.imei || '—' }}</dd></div>
    </dl>
    <v-skeleton-loader v-else type="text@3" bg-color="transparent" />
  </section>
</template>

<style scoped>
.hk-sim {
  margin: 0;
  font-size: 14px;
}
.hk-sim > div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 14px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-sim dt {
  color: rgb(var(--v-theme-on-surface-muted));
  flex-grow: 1;
}
.hk-sim dd {
  margin: 0;
  font-size: 13px;
  text-align: right;
}
.hk-reveal {
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 4px 0;
}
</style>
