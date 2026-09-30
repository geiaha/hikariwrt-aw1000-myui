<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import PageHeader from '@/components/PageHeader.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import ConnectionHero from '@/components/home/ConnectionHero.vue'
import PhoneHero from '@/components/home/PhoneHero.vue'
import CellUplinkCard from '@/components/internet/CellUplinkCard.vue'
import MultiWanSettingsCard from '@/components/internet/MultiWanSettingsCard.vue'
import RouterModeCard from '@/components/internet/RouterModeCard.vue'
import WanSettingsCard from '@/components/internet/WanSettingsCard.vue'
import * as api from '@/api/router'
import * as modem from '@/api/modem'
import * as svc from '@/api/services'
import { multiwanFull, wanConfig, type MultiwanFull, type WanConfig } from '@/api/wan'
import { usePoll } from '@/composables/poll'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'
import { uplinkViews } from '@/utils/uplinks'
import { useFiveGRouter } from '@/composables/fivegRouter'
import { useUptimeToday } from '@/composables/uptime'

// Internet: live uplink status (5 s, the same sources as Home), and the
// settings behind it. Settings load once and again after each save.
const { xs } = useDisplay()
const session = useSession()
const ui = useUi()
const hasModem = computed(() => session.has('luci.aw1000-modem'))
const uptime = useUptimeToday()
const hasMonitor = computed(() => session.has('luci.aw1000-monitor'))

const live = usePoll(async () => {
  const [ifaces, mw, st] = await Promise.all([
    api.interfaces(),
    svc.multiwanStatus(),
    hasModem.value ? modem.status().catch(() => null) : Promise.resolve(null),
  ])
  return { ifaces, mw, modem: st }
}, 5000)

// A "5G router" has no wired uplink (its WAN port is a LAN port), so only
// the 5G one is shown: no wired settings, no failover to set up.
const { fiveG } = useFiveGRouter()
const uplinks = computed(() => {
  const all = live.data.value ? uplinkViews(live.data.value.ifaces, live.data.value.mw) : null
  return all && fiveG.value ? all.filter((u) => u.cellular) : all
})
const wired = computed(() => uplinks.value?.find((u) => !u.cellular) ?? null)
const cellular = computed(() => uplinks.value?.find((u) => u.cellular) ?? null)
const lanIp = computed(() => live.data.value?.ifaces.find((i) => i.interface === 'lan')?.['ipv4-address']?.[0]?.address ?? null)

const wan = ref<WanConfig | null>(null)
const mw = ref<MultiwanFull | null>(null)
const router = ref<modem.RouterStatus | null>(null)
async function loadSettings(): Promise<void> {
  const [w, m, r] = await Promise.all([
    wanConfig(),
    multiwanFull(),
    hasModem.value ? modem.routerstatus().catch(() => null) : Promise.resolve(null),
  ])
  wan.value = w
  mw.value = m
  router.value = r
}
onMounted(loadSettings)

function saved(): void {
  loadSettings()
  // Let netifd / multiwand act before the next status read.
  setTimeout(() => live.refresh(), 3000)
}
</script>

<template>
  <PageHeader :overline="fiveG ? '5G router: the SIM is your internet' : 'Uplinks, failover and 5G'" title="Internet">
    <template #actions>
      <v-btn v-if="hasMonitor" variant="text" color="primary" height="48" rounded="pill" to="/monitoring">
        <HkIcon name="chart" :size="18" class="mr-2" />Uptime &amp; quality
      </v-btn>
      <v-btn variant="flat" color="secondary-container" height="48" rounded="pill" @click="ui.openSpeedTest()">
        <HkIcon name="speed" :size="18" class="mr-2" />Speed test
      </v-btn>
    </template>
  </PageHeader>

  <PhoneHero v-if="xs" :uplinks="uplinks" :modem="live.data.value?.modem ?? null" :uptime="uptime" />
  <ConnectionHero v-else :uplinks="uplinks" :modem="live.data.value?.modem ?? null" :lan-ip="lanIp" :clients="null" hide-clients :uptime="uptime" />

  <div class="hk-inet">
    <WanSettingsCard v-if="!fiveG" class="hk-inet__wide" :config="wan" :link="wired" @saved="saved" />
    <CellUplinkCard v-if="hasModem" :class="{ 'hk-inet__wide': fiveG }" :link="cellular" :modem="live.data.value?.modem ?? null" />
    <MultiWanSettingsCard v-if="!fiveG" class="hk-inet__wide" :config="mw" :status="live.data.value?.mw ?? null" @saved="saved" />
    <RouterModeCard v-if="hasModem" :status="router" />
  </div>
</template>

<style scoped>
.hk-inet {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.hk-inet__wide {
  grid-column: span 2;
}
@media (max-width: 1279.98px) {
  .hk-inet {
    grid-template-columns: minmax(0, 1fr);
  }
  .hk-inet__wide {
    grid-column: auto;
  }
}
</style>
