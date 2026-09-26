<script setup lang="ts">
import { computed } from 'vue'
import { encode } from 'uqr'
import { wifiPayload } from '@/utils/wifiqr'

// Scan-to-join QR. Always dark modules on a white tile whatever the theme:
// phone cameras read dark-on-light reliably, inverted codes much less so.
const props = withDefaults(defineProps<{ ssid: string; password: string; encryption: string; size?: number }>(), { size: 200 })

const qr = computed(() => encode(wifiPayload(props.ssid, props.password, props.encryption), { ecc: 'M', border: 2 }))
// One path of 1x1 squares; the viewBox scales it crisply at any size.
const path = computed(() => {
  let d = ''
  qr.value.data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)))
  return d
})
</script>

<template>
  <div class="hk-qr" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${qr.size} ${qr.size}`" width="100%" height="100%" role="img" :aria-label="`QR code to join ${ssid}`" shape-rendering="crispEdges">
      <rect :width="qr.size" :height="qr.size" fill="#fff" />
      <path :d="path" fill="#1a1a1a" />
    </svg>
  </div>
</template>

<style scoped>
.hk-qr {
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  padding: 8px;
  box-sizing: border-box;
  flex-shrink: 0;
}
</style>
