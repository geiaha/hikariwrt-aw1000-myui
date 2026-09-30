<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { UplinkView } from '@/composables/home'
import type { ModemStatus } from '@/api/modem'
import { durationLong } from '@/utils/format'
import { uptimePct } from '@/utils/series'

// The primary-container hero: status text on the left, and the connection
// drawn as a path: Internet -> uplinks (solid = carrying traffic, dashed =
// standby/down) -> this router -> clients.
const props = defineProps<{
  uplinks: UplinkView[] | null
  modem: ModemStatus | null
  lanIp: string | null
  clients: number | null
  /** The Internet page draws the path up to the router only. */
  hideClients?: boolean
  /** 24-hour uptime per WAN name, from the monitor (null without it). */
  uptime?: Record<string, number | null> | null
}>()

const uptimeToday = computed(() => {
  const name = active.value?.name
  const v = name ? props.uptime?.[name] : null
  return v == null ? null : uptimePct(v)
})

const active = computed(() => props.uplinks?.find((u) => u.state === 'active') ?? null)
const standby = computed(() => props.uplinks?.filter((u) => u.state === 'standby') ?? [])

const subtitle = computed(() => {
  if (!active.value) return 'No uplink is carrying traffic'
  const rest = standby.value.map((s) => (s.cellular ? '5G' : s.label))
  return `via ${active.value.label}${rest.length ? ` · ${rest.join(', ')} on standby` : ''}`
})

function detail(u: UplinkView): string {
  if (u.cellular && props.modem?.operator) {
    const op = props.modem.operator
    const mode = props.modem.mode_label ? `NR5G-${props.modem.mode_label.replace(/^5G-/, '')}` : ''
    return [op, [mode, props.modem.signal?.band].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  }
  return [u.proto, u.ipv4].filter(Boolean).join(' · ')
}

const STATE_WORD = { active: 'active', standby: 'standby', down: 'down' } as const
</script>

<template>
  <section class="hk-hero" aria-label="Connection">
    <div class="hk-hero__text">
      <span class="hk-hero__kicker">Internet</span>
      <span class="hk-display hk-hero__status">{{ uplinks ? (active ? 'Online' : 'Offline') : '…' }}</span>
      <span class="hk-hero__sub">{{ uplinks ? subtitle : 'Checking the connection' }}</span>
      <span v-if="active || lanIp" class="hk-hero__meta">
        <template v-if="active?.uptime != null">Up {{ durationLong(active.uptime) }}</template>
        <template v-if="active?.uptime != null && lanIp"> · </template>
        <template v-if="lanIp">LAN {{ lanIp }}</template>
      </span>
      <RouterLink v-if="uptimeToday" to="/monitoring" class="hk-hero__uptime">{{ uptimeToday }} uptime today →</RouterLink>
    </div>

    <div class="hk-hero__map" aria-hidden="true">
      <div class="hk-node">
        <div class="hk-node__disc"><HkIcon name="internet" :size="32" :stroke="1.8" /></div>
        <span>Internet</span>
      </div>

      <div class="hk-links">
        <div v-for="u in uplinks ?? []" :key="u.name" class="hk-link-row" :class="`is-${u.state}`">
          <div class="hk-wire" />
          <div class="hk-pill">
            <HkIcon :name="u.cellular ? 'cellular' : 'ethernet'" :size="20" class="hk-pill__icon" />
            <div class="hk-pill__text">
              <span class="hk-pill__title">{{ u.label }} · {{ STATE_WORD[u.state] }}</span>
              <span class="hk-pill__sub">{{ detail(u) }}</span>
            </div>
          </div>
          <div class="hk-wire" />
        </div>
      </div>

      <div class="hk-node hk-node--router">
        <!-- M3 expressive "cookie" shape, as drawn on the canvas -->
        <svg width="92" height="92" viewBox="-2 -2 92 92" class="hk-cookie">
          <path
            d="M44.0 -1.2L46.6 -0.7L49.1 0.7L51.3 2.6L53.3 4.7L55.3 6.4L57.3 7.5L59.5 8.0L62.1 7.9L65.0 7.6L68.0 7.6L70.7 8.1L73.1 9.4L74.7 11.4L75.7 14.1L76.2 17.0L76.4 19.9L76.8 22.4L77.6 24.6L79.1 26.4L81.1 28.0L83.5 29.6L85.8 31.5L87.6 33.7L88.5 36.2L88.5 38.8L87.5 41.5L86.0 44.0L84.3 46.3L83.0 48.6L82.2 50.7L82.2 53.0L82.7 55.6L83.5 58.4L84.0 61.3L84.0 64.1L83.1 66.6L81.4 68.6L79.0 70.0L76.2 71.0L73.4 71.7L70.9 72.5L68.9 73.7L67.4 75.5L66.2 77.8L65.0 80.4L63.6 83.0L61.7 85.1L59.5 86.5L56.8 86.9L54.1 86.4L51.3 85.4L48.7 84.1L46.3 83.2L44.0 82.8L41.7 83.2L39.3 84.1L36.7 85.4L33.9 86.4L31.2 86.9L28.5 86.5L26.3 85.1L24.4 83.0L23.0 80.4L21.8 77.8L20.6 75.5L19.1 73.7L17.1 72.5L14.6 71.7L11.8 71.0L9.0 70.0L6.6 68.6L4.9 66.6L4.0 64.1L4.0 61.3L4.5 58.4L5.3 55.6L5.8 53.0L5.8 50.7L5.0 48.6L3.7 46.3L2.0 44.0L0.5 41.5L-0.5 38.8L-0.5 36.2L0.4 33.7L2.2 31.5L4.5 29.6L6.9 28.0L8.9 26.4L10.4 24.6L11.2 22.4L11.6 19.9L11.8 17.0L12.3 14.1L13.3 11.4L14.9 9.4L17.3 8.1L20.0 7.6L23.0 7.6L25.9 7.9L28.5 8.0L30.7 7.5L32.7 6.4L34.7 4.7L36.7 2.6L38.9 0.7L41.4 -0.7L44.0 -1.2Z"
          />
          <g transform="translate(26 26) scale(1.5)" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="hk-cookie__glyph">
            <rect x="3" y="13" width="18" height="7" rx="2" />
            <path d="M7 16.5h.01M11 16.5h.01M8 9.5a5.5 5.5 0 0 1 8 0M10.3 11.5a2.3 2.3 0 0 1 3.4 0" />
          </g>
        </svg>
        <span>AW1000</span>
      </div>

      <template v-if="!hideClients">
        <div class="hk-wire hk-wire--short" />
        <div class="hk-node">
          <div class="hk-node__count hk-display">{{ clients ?? '–' }}</div>
          <span>Clients</span>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.hk-hero {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  border-radius: var(--hk-r-hero);
  padding: 28px 36px;
  display: flex;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
}
.hk-hero__text {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hk-hero__kicker {
  font-size: 14px;
  font-weight: 600;
}
.hk-hero__status {
  font-size: 56px;
  letter-spacing: -1px;
}
.hk-hero__sub {
  font-size: 15px;
}
.hk-hero__uptime {
  align-self: flex-start;
  margin-top: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  background: rgba(var(--v-theme-on-primary-container), 0.1);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.hk-hero__uptime:hover {
  background: rgba(var(--v-theme-on-primary-container), 0.16);
}
.hk-hero__meta {
  font-size: 13px;
  opacity: 0.8;
  padding-top: 6px;
}

.hk-hero__map {
  flex: 1 1 560px;
  min-width: 0;
  display: flex;
  align-items: center;
}
.hk-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 88px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 13px;
}
.hk-node--router {
  width: 104px;
}
.hk-node__disc {
  width: 72px;
  height: 72px;
  border-radius: 36px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  display: flex;
  align-items: center;
  justify-content: center;
}
.hk-node__count {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 28px;
}
.hk-cookie {
  display: block;
}
.hk-cookie path {
  fill: rgb(var(--v-theme-tertiary));
}
.hk-cookie__glyph {
  stroke: rgb(var(--v-theme-surface-container-lowest));
}

.hk-links {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 26px;
}
.hk-link-row {
  display: flex;
  align-items: center;
}
.hk-wire {
  flex-grow: 1;
  min-width: 12px;
  height: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}
.hk-link-row:not(.is-active) .hk-wire {
  height: 0;
  background: none;
  border-top: 3px dashed rgb(var(--v-theme-outline));
}
.hk-link-row.is-down .hk-wire {
  border-top-color: rgb(var(--v-theme-error));
}
.hk-wire--short {
  flex: 0 0 48px;
  margin-bottom: 26px;
}
.hk-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 18px 0 14px;
  border-radius: 24px;
  min-width: 0;
  max-width: 280px;
  box-sizing: border-box;
  border: 1px solid rgb(var(--v-theme-outline));
}
.is-active .hk-pill {
  border-color: transparent;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-on-surface));
}
.is-active .hk-pill__icon {
  color: rgb(var(--v-theme-primary));
}
.is-down .hk-pill {
  border-color: rgb(var(--v-theme-error));
}
.hk-pill__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.hk-pill__title {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}
.hk-pill__sub {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-active .hk-pill__sub {
  color: rgb(var(--v-theme-on-surface-muted));
}

@media (max-width: 1279.98px) {
  .hk-hero {
    gap: 24px;
  }
  .hk-hero__map {
    flex-basis: 100%;
  }
}
</style>
