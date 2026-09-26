<script setup lang="ts">
import { computed } from 'vue'
import M3Progress from '@/components/m3/M3Progress.vue'
import type { UsageInfo } from '@/api/modem'
import { bytes } from '@/utils/format'

// Two small cards under the quick settings: clients, and 5G data this cycle
// (as a share of the plan when a limit is set, else the amount used).
const props = defineProps<{ clients: { total: number; wifi: number; wired: number } | null; usage?: UsageInfo | null }>()

const data = computed(() => {
  const u = props.usage
  if (!u?.ok) return null
  const limited = u.settings.limit > 0
  return {
    big: limited ? `${u.cycle.percent}%` : bytes(u.cycle.total),
    pct: limited ? u.cycle.percent : null,
    sub: limited ? `${bytes(u.cycle.total)} of ${u.cycle.limit_human}` : `resets on the ${ordinal(u.settings.reset_day)}`,
  }
})

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
</script>

<template>
  <div class="hk-pstats">
    <section class="hk-pstat" aria-label="Clients">
      <span class="hk-pstat__label">Clients</span>
      <span class="hk-display hk-pstat__big">{{ clients?.total ?? '–' }}</span>
      <span v-if="clients" class="hk-label">{{ clients.wifi }} Wi-Fi · {{ clients.wired }} wired</span>
    </section>
    <section v-if="usage !== undefined" class="hk-pstat" aria-label="5G data">
      <span class="hk-pstat__label">5G data</span>
      <span class="hk-display hk-pstat__big">{{ data?.big ?? '–' }}</span>
      <M3Progress v-if="data?.pct != null" :value="data.pct" label="5G data used" :height="6" :stop="false" style="margin: 4px 0" />
      <span v-if="data" class="hk-label">{{ data.sub }}</span>
    </section>
  </div>
</template>

<style scoped>
.hk-pstats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.hk-pstat {
  background: rgb(var(--v-theme-surface-container));
  border-radius: 24px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.hk-pstat__label {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-pstat__big {
  font-size: 34px;
  line-height: 1.15;
  white-space: nowrap;
}
</style>
