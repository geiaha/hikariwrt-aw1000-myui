<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { IconName } from '@/components/icons/registry'
import { leases as fetchLeases, type Lease } from '@/api/router'
import { luciUrl, NAV } from '@/nav'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'

// "Search settings, clients, bands" from the design's header. Matches pages,
// sections inside them and connected clients; choosing one navigates.
// Clients are fetched when the field is first focused, not on every page.
withDefaults(defineProps<{ autofocus?: boolean; width?: string }>(), { width: '380px' })
const emit = defineEmits<{ done: [] }>()

interface Hit {
  title: string
  subtitle?: string
  icon: IconName
  keywords: string
  go: () => void
}

const router = useRouter()
const session = useSession()
const ui = useUi()
const clients = ref<Lease[]>([])
const model = ref<Hit | null>(null)
let fetched = false

const SECTIONS: { title: string; path: string; icon: IconName; keywords: string; requires?: string }[] = [
  { title: 'Band & cell lock', path: '/cellular?tab=lock', icon: 'lock', keywords: 'band lock cell pci arfcn n78 n41 n28 lte nr', requires: 'luci.aw1000-modem' },
  { title: 'SMS messages', path: '/cellular?tab=sms', icon: 'message', keywords: 'sms text message inbox', requires: 'luci.aw1000-modem' },
  { title: 'APN & IPv6', path: '/cellular?tab=apn', icon: 'cellular', keywords: 'apn ipv6 profile ttl', requires: 'luci.aw1000-modem' },
  { title: 'Data usage', path: '/cellular?tab=usage', icon: 'cellular', keywords: 'data usage limit quota month', requires: 'luci.aw1000-modem' },
  { title: 'AT console', path: '/cellular?tab=at', icon: 'cellular', keywords: 'at command console', requires: 'luci.aw1000-modem' },
  { title: 'Multi-WAN', path: '/internet', icon: 'internet', keywords: 'failover load balance priority sms alert' },
]

const hits = computed<Hit[]>(() => [
  ...NAV.filter((n) => !n.requires || session.has(n.requires)).map((n) => ({
    title: n.title,
    subtitle: 'Page',
    icon: n.icon,
    keywords: `${n.title} ${n.keywords ?? ''}`,
    go: () => router.push(n.path),
  })),
  ...SECTIONS.filter((s) => !s.requires || session.has(s.requires)).map((s) => ({
    title: s.title,
    subtitle: 'Section',
    icon: s.icon,
    keywords: `${s.title} ${s.keywords}`,
    go: () => router.push(s.path),
  })),
  {
    title: 'Speed test',
    subtitle: 'Action',
    icon: 'speed',
    keywords: 'speed test ookla bandwidth',
    go: () => ui.openSpeedTest(),
  },
  {
    title: 'Appearance',
    subtitle: 'Colour and theme',
    icon: 'palette',
    keywords: 'appearance theme colour color dark light seed',
    go: () => (ui.drawer = true),
  },
  {
    title: 'Advanced settings',
    subtitle: 'OpenWrt LuCI',
    icon: 'advanced',
    keywords: 'advanced luci openwrt firewall',
    go: () => (window.location.href = luciUrl()),
  },
  ...clients.value.map((c) => ({
    title: c.hostname || c.macaddr,
    subtitle: `Client · ${c.ipaddr ?? c.macaddr}`,
    icon: 'clients' as const,
    keywords: `${c.hostname ?? ''} ${c.ipaddr ?? ''} ${c.macaddr}`,
    go: () => router.push({ path: '/clients', query: { mac: c.macaddr } }),
  })),
])

function filter(_value: string, query: string, item?: { raw: Hit }): boolean {
  const hay = item?.raw.keywords.toLowerCase() ?? ''
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

async function onFocus(): Promise<void> {
  if (fetched) return
  fetched = true
  clients.value = await fetchLeases().catch(() => [])
}

function pick(h: Hit | null): void {
  if (!h) return
  h.go()
  model.value = null
  emit('done')
}
</script>

<template>
  <v-autocomplete
    v-model="model"
    :items="hits"
    item-title="title"
    return-object
    :custom-filter="filter"
    placeholder="Search settings, clients, bands"
    aria-label="Search settings"
    variant="solo"
    flat
    rounded="pill"
    bg-color="surface-container-high"
    hide-details
    menu-icon=""
    auto-select-first
    :autofocus="autofocus"
    no-data-text="Nothing matches"
    :menu-props="{ maxHeight: 400 }"
    class="hk-search"
    :style="{ maxWidth: width, width: '100%' }"
    @update:focused="(f: boolean) => f && onFocus()"
    @update:model-value="pick"
  >
    <template #prepend-inner>
      <HkIcon name="search" class="text-muted ml-1 mr-2" />
    </template>
    <template #item="{ props: p, item }">
      <v-list-item v-bind="p" :title="item.title" :subtitle="item.subtitle">
        <template #prepend>
          <HkIcon :name="item.icon" class="mr-4 text-muted" />
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<style scoped>
.hk-search :deep(.v-field) {
  min-height: 56px;
  padding-inline: 16px 20px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-search :deep(input) {
  font-size: 16px;
  color: rgb(var(--v-theme-on-surface));
}
</style>
