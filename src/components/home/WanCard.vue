<script setup lang="ts">
import HkIcon from '@/components/icons/HkIcon.vue'
import type { UplinkView } from '@/composables/home'
import { duration } from '@/utils/format'
import { useUi } from '@/stores/ui'

defineProps<{ link: UplinkView | null; loading: boolean }>()
const ui = useUi()
</script>

<template>
  <section class="hk-card" aria-label="Wired WAN">
    <div class="d-flex align-center ga-2">
      <h2 class="hk-h2 flex-grow-1">{{ link?.label ?? 'Wired WAN' }}</h2>
      <template v-if="link">
        <span v-if="link.state !== 'down'" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />Connected</span>
        <span v-else class="hk-chip hk-chip--error">Down</span>
      </template>
    </div>
    <div v-if="link" class="hk-facts">
      <div><span class="hk-label">Protocol</span><span class="hk-fact-strong">{{ link.proto || '—' }}</span></div>
      <div><span class="hk-label">Uptime</span><span class="hk-fact-strong">{{ duration(link.uptime) }}</span></div>
      <div><span class="hk-label">IPv4</span><span class="hk-fact">{{ link.ipv4 ?? '—' }}</span></div>
      <div><span class="hk-label">Gateway</span><span class="hk-fact">{{ link.gateway ?? '—' }}</span></div>
    </div>
    <p v-else-if="!loading" class="text-body-medium text-muted">No wired WAN interface is configured.</p>
    <v-skeleton-loader v-else type="text, text" bg-color="transparent" />
    <div class="d-flex flex-wrap ga-2 mt-auto">
      <v-btn to="/internet" variant="outlined" color="primary" height="40" class="hk-outline-btn">Settings</v-btn>
      <v-btn variant="flat" color="secondary-container" height="40" @click="ui.openSpeedTest(link?.name ?? null)">Speed test</v-btn>
    </div>
  </section>
</template>

<style scoped>
.hk-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  font-size: 14px;
}
.hk-facts > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.hk-fact-strong {
  font-weight: 600;
}
.hk-fact {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.hk-outline-btn {
  border-color: rgb(var(--v-theme-outline));
}
</style>
