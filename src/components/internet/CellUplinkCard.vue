<script setup lang="ts">
import HkIcon from '@/components/icons/HkIcon.vue'
import type { ModemStatus } from '@/api/modem'
import type { UplinkView } from '@/utils/uplinks'

defineProps<{ link: UplinkView | null; modem: ModemStatus | null }>()
</script>

<template>
  <section class="hk-card" aria-label="5G uplink" style="gap: 12px">
    <div class="d-flex align-center ga-2">
      <h2 class="hk-h2 flex-grow-1">5G cellular</h2>
      <template v-if="link">
        <span v-if="link.state === 'active'" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />In use</span>
        <span v-else-if="link.state === 'standby'" class="hk-chip hk-chip--outline">Standby</span>
        <span v-else class="hk-chip hk-chip--error">Down</span>
      </template>
    </div>
    <dl class="hk-group hk-kv">
      <div><dt>Network</dt><dd>{{ modem?.operator?.replace(/^\d{3} \d{2,3} /, '') || '—' }}<template v-if="modem?.mode_label"> · {{ modem.mode_label }}</template></dd></div>
      <div><dt>Band</dt><dd>{{ modem?.signal?.band ?? '—' }}</dd></div>
      <div><dt>Address</dt><dd>{{ link?.ipv4 ?? '—' }}</dd></div>
      <div><dt>Latency</dt><dd>{{ link?.latency != null ? `${link.latency.toFixed(0)} ms` : '—' }}</dd></div>
    </dl>
    <div class="d-flex flex-wrap ga-2 mt-auto">
      <v-btn to="/cellular" variant="outlined" color="primary" height="40" style="border-color: rgb(var(--v-theme-outline))">Cellular</v-btn>
      <v-btn :to="{ path: '/cellular', query: { tab: 'apn' } }" variant="flat" color="secondary-container" height="40">APN</v-btn>
    </div>
  </section>
</template>

<style scoped>
.hk-kv {
  margin: 0;
  font-size: 14px;
}
.hk-kv > div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 14px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-kv dt {
  flex-grow: 1;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-kv dd {
  margin: 0;
  font-size: 13px;
  text-align: right;
}
</style>
