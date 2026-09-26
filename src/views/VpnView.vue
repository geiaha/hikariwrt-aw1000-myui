<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import AddTunnelDialog from '@/components/vpn/AddTunnelDialog.vue'
import TunnelCard from '@/components/vpn/TunnelCard.vue'
import * as vpn from '@/api/vpn'
import { usePoll } from '@/composables/poll'

// VPN: WireGuard tunnels. The list is polled every 10 s for handshakes and
// traffic; cards keep your unsaved routing edits across refreshes.
const list = usePoll(() => vpn.list(), 10000)
const nets = ref<vpn.VpnNetworks | null>(null)
const adding = ref(false)
onMounted(async () => (nets.value = await vpn.networks().catch(() => null)))

const tunnels = computed(() => list.data.value?.tunnels ?? [])
const up = computed(() => tunnels.value.filter((t) => t.enabled && t.up).length)
</script>

<template>
  <PageHeader :overline="list.data.value ? `${tunnels.length} ${tunnels.length === 1 ? 'tunnel' : 'tunnels'} · ${up} running` : 'WireGuard'" title="VPN">
    <template #actions>
      <v-btn variant="flat" color="primary" height="48" rounded="pill" @click="adding = true">Add tunnel</v-btn>
    </template>
  </PageHeader>

  <v-alert v-if="list.error.value" type="error" variant="tonal" rounded="xl">
    {{ list.error.value instanceof Error ? list.error.value.message : list.error.value }}
  </v-alert>
  <v-alert v-else-if="list.data.value && !list.data.value.wg" type="warning" variant="tonal" rounded="xl">
    The WireGuard tools aren’t installed on this router, so tunnels can’t run.
  </v-alert>

  <section v-if="list.data.value && !tunnels.length" class="hk-card hk-empty">
    <span class="hk-empty__icon"><HkIcon name="vpn" :size="36" /></span>
    <h2 class="hk-h2" style="font-size: 24px">No VPN tunnels yet</h2>
    <p class="text-muted">
      Add the WireGuard config from your VPN provider, then choose which devices use it: everyone, only some networks, or just a few devices.
    </p>
    <v-btn variant="flat" color="primary" height="44" @click="adding = true">Add tunnel</v-btn>
  </section>

  <div v-else class="hk-grid-3" style="align-items: start">
    <TunnelCard v-for="t in tunnels" :key="t.name" :tunnel="t" :nets="nets" @changed="list.refresh()" />
    <template v-if="!list.data.value && !list.error.value">
      <v-skeleton-loader v-for="i in 2" :key="i" type="heading, text@6" class="hk-card" />
    </template>
  </div>

  <AddTunnelDialog v-model="adding" @added="list.refresh()" />
</template>

<style scoped>
.hk-empty {
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  gap: 12px;
  max-width: 720px;
}
.hk-empty p {
  margin: 0;
  max-width: 480px;
}
.hk-empty__icon {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
</style>
