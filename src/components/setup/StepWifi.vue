<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SecretField from '@/components/m3/SecretField.vue'
import type { SetupState } from '@/composables/setup'
import { generatePassword } from '@/utils/validate'

// One name for both bands (devices pick the better one by themselves), or
// a name per band. Security defaults to WPA2/WPA3, which every current
// device joins; open networks are left to the Wireless page.
const props = defineProps<{ s: SetupState }>()
const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const SECURITY = [
  { value: 'sae-mixed', title: 'WPA2 / WPA3 (recommended)' },
  { value: 'psk2', title: 'WPA2' },
  { value: 'psk-mixed', title: 'WPA / WPA2 (older devices)' },
  { value: 'sae', title: 'WPA3 only' },
]
const e = computed(() => props.s.wifiErrors.value)
</script>

<template>
  <div class="d-flex align-center ga-3">
    <div class="d-flex flex-column flex-grow-1">
      <span style="font-size: 15px; font-weight: 500">Same name on both bands</span>
      <span class="hk-label">Devices move between 2.4 and 5 GHz by themselves</span>
    </div>
    <M3Switch v-model="s.draft.wifi.same" label="Same name on both bands" />
  </div>

  <template v-if="s.draft.wifi.same">
    <v-text-field v-model="s.draft.wifi.ssid" label="Network name" hide-details="auto" :error-messages="e.ssid || undefined" />
    <div class="d-flex align-start ga-2">
      <SecretField v-model="s.draft.wifi.key" label="Wi-Fi password" :error-messages="e.key" class="flex-grow-1" />
      <v-btn icon variant="text" width="56" height="56" aria-label="Make a new password" title="Make a new password" @click="s.draft.wifi.key = generatePassword()">
        <HkIcon name="refresh" />
      </v-btn>
    </div>
    <v-select v-model="s.draft.wifi.encryption" :items="SECURITY" label="Security" hide-details />
  </template>

  <template v-else>
    <div v-for="(b, i) in s.draft.wifi.bands" :key="b.section" class="hk-band">
      <span class="hk-h2" style="font-size: 16px">{{ BAND[b.band] ?? b.band }}</span>
      <v-text-field v-model="b.ssid" label="Network name" hide-details="auto" :error-messages="e.bands[i]?.ssid || undefined" />
      <div class="d-flex align-start ga-2">
        <SecretField v-model="b.key" label="Wi-Fi password" :error-messages="e.bands[i]?.key" class="flex-grow-1" />
        <v-btn icon variant="text" width="56" height="56" aria-label="Make a new password" @click="b.key = generatePassword()"><HkIcon name="refresh" /></v-btn>
      </div>
      <v-select v-model="b.encryption" :items="SECURITY" label="Security" hide-details />
    </div>
  </template>

  <span class="hk-label">Devices on Wi-Fi now will need to join again with these details. The mesh link between routers isn’t affected.</span>
</template>

<style scoped>
.hk-band {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-low));
}
</style>
