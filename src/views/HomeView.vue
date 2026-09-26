<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import PageHeader from '@/components/PageHeader.vue'
import CellCard from '@/components/home/CellCard.vue'
import ConnectionHero from '@/components/home/ConnectionHero.vue'
import MultiWanCard from '@/components/home/MultiWanCard.vue'
import PhoneHero from '@/components/home/PhoneHero.vue'
import PhoneStats from '@/components/home/PhoneStats.vue'
import QuickSettings from '@/components/home/QuickSettings.vue'
import SystemCard from '@/components/home/SystemCard.vue'
import WanCard from '@/components/home/WanCard.vue'
import WifiCard from '@/components/home/WifiCard.vue'
import { useHomeData } from '@/composables/home'
import { useSession } from '@/stores/session'

const { xs } = useDisplay()
const session = useSession()
const d = useHomeData()

const f = computed(() => d.fast.data.value)
const s = computed(() => d.slow.data.value)
const guests = computed(() => s.value?.aps?.filter((a) => a.guest) ?? [])
const overline = computed(() => `${session.board?.hostname ?? 'HikariWrt'} · ${session.board?.model ?? ''}`)

// After a change, refresh now rather than on the next tick (up to 15 s).
const changed = () => d.slow.refresh()
const changedBoth = () => {
  d.fast.refresh()
  d.slow.refresh()
}
</script>

<template>
  <PageHeader :overline="overline" title="Home" hide-on-phone />

  <v-alert v-if="d.fast.error.value" type="error" variant="tonal" rounded="xl">
    Can't read the router's status: {{ d.fast.error.value instanceof Error ? d.fast.error.value.message : d.fast.error.value }}
  </v-alert>

  <!-- Phone layout -->
  <template v-if="xs">
    <PhoneHero :uplinks="d.uplinks.value" :modem="f?.modem ?? null" />
    <section aria-label="Quick settings" class="d-flex flex-column ga-2">
      <h2 class="text-muted" style="margin: 0; padding: 4px 4px 0; font-size: 14px; font-weight: 600">Quick settings</h2>
      <QuickSettings
        compact
        :aps="s?.aps ?? null"
        :tunnels="s?.vpn?.tunnels ?? null"
        :router="s?.router ?? null"
        :adblock="s ? s.adblock : false"
        :guests="guests"
        :has-vpn="session.has('luci.aw1000-vpn')"
        :has-modem="d.hasModem.value"
        @changed="changed"
      />
    </section>
    <PhoneStats :clients="d.clients.value" :usage="d.hasModem.value ? (s?.usage ?? null) : undefined" />
    <CellCard v-if="d.hasModem.value" :modem="f?.modem ?? null" :link="d.cellular.value" :loading="!f" />
    <WifiCard :aps="s?.aps ?? null" :radios="s?.radios ?? null" :mesh="s?.mesh ?? null" @changed="changed" />
    <MultiWanCard :uplinks="d.uplinks.value" :config="s?.mwConf ?? null" @changed="changedBoth" />
    <SystemCard :board="session.board" :info="f?.info ?? null" :cpu="d.cpu.value" :storage="s?.storage ?? null" />
  </template>

  <!-- Rail layout -->
  <template v-else>
    <ConnectionHero :uplinks="d.uplinks.value" :modem="f?.modem ?? null" :lan-ip="d.lanIp.value" :clients="d.clients.value?.total ?? null" />
    <div class="hk-grid-3">
      <WanCard :link="d.wired.value" :loading="!f" />
      <CellCard v-if="d.hasModem.value" :modem="f?.modem ?? null" :link="d.cellular.value" :loading="!f" />
      <MultiWanCard :uplinks="d.uplinks.value" :config="s?.mwConf ?? null" @changed="changedBoth" />
      <WifiCard :aps="s?.aps ?? null" :radios="s?.radios ?? null" :mesh="s?.mesh ?? null" @changed="changed" />
      <section class="hk-card" aria-label="Quick settings" style="gap: 14px">
        <h2 class="hk-h2">Quick settings</h2>
        <QuickSettings
          :tunnels="s?.vpn?.tunnels ?? null"
          :router="s?.router ?? null"
          :adblock="s ? s.adblock : false"
          :guests="guests"
          :has-vpn="session.has('luci.aw1000-vpn')"
          :has-modem="d.hasModem.value"
          @changed="changed"
        />
      </section>
      <SystemCard :board="session.board" :info="f?.info ?? null" :cpu="d.cpu.value" :storage="s?.storage ?? null" />
    </div>
  </template>
</template>
