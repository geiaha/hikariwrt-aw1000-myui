<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { UplinkView } from '@/composables/home'
import type { ModemStatus } from '@/api/modem'
import { signed } from '@/utils/format'
import { uptimePct } from '@/utils/series'

// Phone hero: the same status as the desktop hero, with the uplinks as a
// connected list instead of a diagram.
const props = defineProps<{
  uplinks: UplinkView[] | null
  modem: ModemStatus | null
  /** 24-hour uptime per WAN name, from the monitor (null without it). */
  uptime?: Record<string, number | null> | null
}>()

const active = computed(() => props.uplinks?.find((u) => u.state === 'active') ?? null)
const standby = computed(() => props.uplinks?.filter((u) => u.state === 'standby') ?? [])
const uptimeToday = computed(() => {
  const v = active.value ? props.uptime?.[active.value.name] : null
  return v == null ? null : uptimePct(v)
})

function detail(u: UplinkView): string {
  if (u.cellular && props.modem?.operator) {
    const s = props.modem.signal
    return [props.modem.operator, s?.band, s?.rsrp != null ? `${signed(s.rsrp)} dBm` : null].filter(Boolean).join(' · ')
  }
  return [u.proto, u.ipv4].filter(Boolean).join(' · ')
}
const WORD = { active: 'In use', standby: 'Standby', down: 'Down' } as const
</script>

<template>
  <section class="hk-phero" aria-label="Internet">
    <div class="d-flex flex-column ga-1">
      <span style="font-size: 13px; font-weight: 600">Internet</span>
      <span class="hk-display" style="font-size: 44px; letter-spacing: -0.5px">{{ uplinks ? (active ? 'Online' : 'Offline') : '…' }}</span>
      <span v-if="uplinks" style="font-size: 14px">
        <template v-if="active">via {{ active.label }}<template v-if="standby.length"> · {{ standby.map((s) => (s.cellular ? '5G' : s.label)).join(', ') }} on standby</template></template>
        <template v-else>No uplink is carrying traffic</template>
      </span>
      <RouterLink v-if="uptimeToday" to="/monitoring" class="hk-phero__uptime">{{ uptimeToday }} uptime today →</RouterLink>
    </div>
    <div class="hk-phero__list">
      <div v-for="u in uplinks ?? []" :key="u.name" class="hk-phero__row" :class="`is-${u.state}`">
        <span class="hk-phero__icon"><HkIcon :name="u.cellular ? 'cellular' : 'ethernet'" :size="18" /></span>
        <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
          <span style="font-weight: 600; font-size: 15px">{{ u.label }}</span>
          <span class="hk-phero__sub">{{ detail(u) }}</span>
        </div>
        <span class="hk-phero__state">{{ WORD[u.state] }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hk-phero__uptime {
  align-self: flex-start;
  margin-top: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  background: rgba(var(--v-theme-on-primary-container), 0.1);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.hk-phero {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  border-radius: 28px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hk-phero__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hk-phero__row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 16px 0 10px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-on-surface));
}
.hk-phero__row:first-child {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}
.hk-phero__row:last-child {
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
}
.hk-phero__icon {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
}
.is-active .hk-phero__icon {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hk-phero__sub {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hk-phero__state {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-muted));
}
.is-active .hk-phero__state {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}
.is-down .hk-phero__state {
  color: rgb(var(--v-theme-error));
}
</style>
