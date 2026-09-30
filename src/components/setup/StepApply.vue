<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import WifiJoin from '@/components/wifi/WifiJoin.vue'
import { lanAddress, primaryNetwork, type SetupState } from '@/composables/setup'

// The task list while setting up, then "all set". The Wi-Fi details and QR
// appear as soon as the Wi-Fi task starts: a browser on Wi-Fi may lose the
// page right then, and this is what it needs to get back.
const props = defineProps<{ s: SetupState }>()
const emit = defineEmits<{ back: []; home: [] }>()

const lan = ref('')
onMounted(async () => (lan.value = await lanAddress()))

const net = computed(() => primaryNetwork(props.s))
const wifiTask = computed(() => props.s.tasks.value.find((t) => t.id === 'wifi') ?? null)
const showJoin = computed(() => props.s.finished.value || (wifiTask.value && wifiTask.value.state !== 'pending'))
const failed = computed(() => props.s.tasks.value.find((t) => t.state === 'failed') ?? null)
</script>

<template>
  <ol class="hk-tasks" aria-live="polite">
    <li v-for="t in s.tasks.value" :key="t.id" :class="t.state">
      <span class="hk-tasks__mark">
        <v-progress-circular v-if="t.state === 'running'" indeterminate size="20" width="2" color="primary" />
        <HkIcon v-else-if="t.state === 'done'" name="check" :size="18" />
        <HkIcon v-else-if="t.state === 'failed'" name="close" :size="18" />
      </span>
      <div class="d-flex flex-column">
        <span style="font-size: 14px">{{ t.label }}</span>
        <span v-if="t.error" class="text-error" style="font-size: 13px">{{ t.error }}</span>
      </div>
    </li>
  </ol>

  <div v-if="failed" class="d-flex flex-wrap ga-2">
    <v-btn variant="flat" color="primary" height="40" @click="s.retry()">Try again</v-btn>
    <v-btn variant="text" color="primary" height="40" @click="emit('back')">Back to review</v-btn>
  </div>

  <WifiJoin v-if="showJoin && net && s.changes.value.wifi" :ssid="net.ssid" :password="net.key" :encryption="net.encryption" title="Join your new Wi-Fi">
    <span class="hk-label">Then open <b>http://{{ lan || '192.168.88.1' }}/webui/</b> to come back here.</span>
  </WifiJoin>

  <template v-if="s.finished.value">
    <div class="hk-next">
      <span class="hk-h2" style="font-size: 16px">What’s next</span>
      <div class="hk-next__grid">
        <router-link to="/wifi" class="hk-next__item"><HkIcon name="guest" />Guest Wi-Fi<span class="hk-label">For visitors</span></router-link>
        <router-link to="/mesh" class="hk-next__item"><HkIcon name="mesh" />Mesh<span class="hk-label">Add another router</span></router-link>
        <router-link to="/vpn" class="hk-next__item"><HkIcon name="vpn" />VPN<span class="hk-label">WireGuard tunnels</span></router-link>
      </div>
    </div>
    <div class="d-flex justify-end">
      <v-btn variant="flat" color="primary" height="44" @click="emit('home')">Go to Home</v-btn>
    </div>
  </template>
</template>

<style scoped>
.hk-tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hk-tasks li {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 8px 16px;
  background: rgb(var(--v-theme-surface-container-low));
  border-radius: 4px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-tasks li:first-child {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}
.hk-tasks li:last-child {
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
}
.hk-tasks li.running,
.hk-tasks li.done {
  color: rgb(var(--v-theme-on-surface));
}
.hk-tasks__mark {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 2px solid rgb(var(--v-theme-outline-variant));
}
.done .hk-tasks__mark {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.running .hk-tasks__mark {
  border-color: transparent;
}
.failed .hk-tasks__mark {
  border-color: rgb(var(--v-theme-error));
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
}
.hk-next {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hk-next__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 599.98px) {
  .hk-next__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hk-next__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-low));
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
  text-decoration: none;
}
.hk-next__item:hover {
  background: rgb(var(--v-theme-surface-container));
}
</style>
