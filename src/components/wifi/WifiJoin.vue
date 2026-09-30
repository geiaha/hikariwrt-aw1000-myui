<script setup lang="ts">
import { ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import WifiQr from '@/components/setup/WifiQr.vue'

// "Join this Wi-Fi": the scan-to-join QR beside the name and password, on a
// primary-container tile. The setup wizard's Done screen and the Wireless page
// both use it, so the two always look the same. The default slot is for one
// more line under the password (the wizard's "then open http://…").
withDefaults(
  defineProps<{ ssid: string; password: string; encryption: string; title?: string; hint?: string; size?: number; stacked?: boolean }>(),
  { title: 'Join your Wi-Fi', hint: 'Scan with a phone camera, or pick the network and type the password.', size: 176 },
)
const reveal = ref(false)
</script>

<template>
  <div class="hk-join" :class="{ 'is-stacked': stacked }">
    <WifiQr :ssid="ssid" :password="password" :encryption="encryption" :size="size" />
    <div class="d-flex flex-column ga-2" style="min-width: 0">
      <span class="hk-h2" style="font-size: 18px">{{ title }}</span>
      <span class="hk-label">{{ hint }}</span>
      <span class="hk-join__name">{{ ssid }}</span>
      <div v-if="encryption !== 'none' && password" class="d-flex align-center ga-2">
        <span class="hk-join__key">{{ reveal ? password : '•'.repeat(Math.min(password.length, 16)) }}</span>
        <v-btn variant="text" size="small" :aria-label="reveal ? 'Hide password' : 'Show password'" @click="reveal = !reveal">
          <HkIcon :name="reveal ? 'eyeOff' : 'eye'" :size="18" class="mr-1" />{{ reveal ? 'Hide' : 'Show' }}
        </v-btn>
      </div>
      <span v-else class="hk-label">No password</span>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.hk-join {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  border-radius: 24px;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.hk-join .hk-label {
  color: inherit;
  opacity: 0.85;
}
.hk-join__key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.hk-join__name {
  font-family: var(--hk-display);
  font-size: 26px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
/* QR above the details: on phones, and in a narrow card */
.hk-join.is-stacked {
  flex-direction: column;
  align-items: stretch;
}
.hk-join.is-stacked :deep(.hk-qr) {
  align-self: center;
}
@media (max-width: 599.98px) {
  .hk-join {
    flex-direction: column;
    align-items: stretch;
  }
  .hk-join :deep(.hk-qr) {
    align-self: center;
  }
}
</style>
