<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import BandCard from '@/components/wifi/BandCard.vue'
import GuestCard from '@/components/wifi/GuestCard.vue'
import { wifiRadios, type WifiRadio } from '@/api/wifi'
import { guestState, type GuestState } from '@/api/guest'

// Wireless: one card per band. Loaded on open and after each save (not
// polled: a refresh while you type would overwrite the form).
const radios = ref<WifiRadio[] | null>(null)
const gstate = ref<GuestState | null>(null)
const error = ref('')

async function load(): Promise<void> {
  try {
    const [r, g] = await Promise.all([wifiRadios(), guestState()])
    radios.value = r
    gstate.value = g
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
onMounted(load)

const ORDER: Record<string, number> = { '6g': 0, '5g': 1, '2g': 2 }
const bands = computed(() =>
  (radios.value ?? [])
    .flatMap((r) => r.networks.filter((n) => !n.guest).map((n) => ({ radio: r, net: n })))
    .sort((a, b) => (ORDER[a.radio.band] ?? 9) - (ORDER[b.radio.band] ?? 9)),
)
const guest = computed(() => (radios.value ?? []).flatMap((r) => r.networks.filter((n) => n.guest).map((n) => ({ radio: r, net: n }))))
const devices = computed(() => bands.value.reduce((a, b) => a + b.net.clients, 0))

function afterSave(): void {
  // Give hostapd a moment to come back before reading the state again.
  setTimeout(load, 4000)
}
</script>

<template>
  <PageHeader :overline="radios ? `${bands.length} networks · ${devices} devices connected` : 'Wi-Fi networks'" title="Wireless" />

  <v-alert v-if="error" type="error" variant="tonal" rounded="xl">{{ error }}</v-alert>

  <div class="hk-grid-3 hk-wifi">
    <template v-if="radios">
      <BandCard v-for="b in bands" :key="b.net.section" :radio="b.radio" :net="b.net" @saved="afterSave" />
      <!-- A guest setup made elsewhere (LuCI) keeps plain band cards. -->
      <template v-if="gstate?.foreign">
        <BandCard v-for="g in guest" :key="g.net.section" :radio="g.radio" :net="g.net" @saved="afterSave" />
      </template>
      <GuestCard v-else-if="gstate" :state="gstate" :radios="radios" @changed="afterSave" />
    </template>
    <template v-else-if="!error">
      <v-skeleton-loader v-for="i in 3" :key="i" type="heading, text@5" class="hk-card" />
    </template>
  </div>
</template>

<style scoped>
.hk-wifi {
  align-items: start;
}
</style>
