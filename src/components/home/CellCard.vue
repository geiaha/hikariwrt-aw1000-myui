<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SignalBars from '@/components/m3/SignalBars.vue'
import type { UplinkView } from '@/composables/home'
import type { ModemStatus } from '@/api/modem'
import { bars5 } from '@/utils/cellular'
import { signed } from '@/utils/format'

const props = defineProps<{ modem: ModemStatus | null; link: UplinkView | null; loading: boolean }>()

const operator = computed(() => props.modem?.operator ?? '')
const mode = computed(() => props.modem?.mode_label?.replace('-', ' ') ?? '')
const s = computed(() => props.modem?.signal ?? null)
</script>

<template>
  <section class="hk-card" aria-label="5G cellular">
    <div class="d-flex align-center ga-2">
      <h2 class="hk-h2 flex-grow-1">5G cellular</h2>
      <template v-if="link">
        <span v-if="link.state === 'active'" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />In use</span>
        <span v-else-if="link.state === 'standby'" class="hk-chip hk-chip--outline">Standby</span>
        <span v-else class="hk-chip hk-chip--error">Down</span>
      </template>
    </div>

    <template v-if="modem">
      <div v-if="modem.sim !== 'ready'" class="d-flex align-center ga-3">
        <span class="hk-simoff"><HkIcon name="simOff" /></span>
        <div>
          <div class="font-weight-bold">No SIM ready</div>
          <div class="hk-label">SIM state: {{ modem.sim }}</div>
        </div>
      </div>
      <template v-else>
        <div class="d-flex align-end ga-4">
          <SignalBars :level="bars5(s?.percent)" />
          <div class="d-flex flex-column" style="min-width: 0">
            <span class="hk-display" style="font-size: 22px; line-height: 1.3">{{ operator || 'Searching' }}<template v-if="mode"> · {{ mode }}</template></span>
            <span class="text-muted" style="font-size: 13px">
              <template v-if="s">Band {{ s.band }} · PCI {{ s.pci ?? '—' }} · ARFCN {{ s.arfcn ?? '—' }}</template>
              <template v-else>{{ modem.registered ? 'Registered' : 'Not registered' }}</template>
            </span>
          </div>
        </div>
        <div class="hk-metrics">
          <div class="hk-tile"><span class="hk-label">RSRP</span><span class="hk-metric">{{ signed(s?.rsrp) }} dBm</span></div>
          <div class="hk-tile"><span class="hk-label">RSRQ</span><span class="hk-metric">{{ signed(s?.rsrq) }} dB</span></div>
          <div class="hk-tile"><span class="hk-label">SINR</span><span class="hk-metric">{{ signed(s?.sinr) }} dB</span></div>
        </div>
      </template>
    </template>
    <v-skeleton-loader v-else-if="loading" type="heading, text" bg-color="transparent" />

    <router-link to="/cellular" class="hk-link mt-auto">Open cellular <HkIcon name="arrowRight" :size="18" /></router-link>
  </section>
</template>

<style scoped>
.hk-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.hk-metric {
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
}
.hk-simoff {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
}
</style>
