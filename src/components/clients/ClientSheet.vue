<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import { disconnectWifi, saveHost, setBlocked } from '@/api/clients'
import type { Client } from '@/utils/clients'
import { rate, signalWord } from '@/utils/clients'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { bytes, duration, signed } from '@/utils/format'
import { ipError } from '@/utils/validate'

// One device: what the router knows about it, and what you can do. The
// form keeps your edits while the list refreshes underneath; it resets only
// when a different device is opened.
const props = defineProps<{ client: Client }>()
const emit = defineEmits<{ changed: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const form = reactive({ name: '', reserve: false, ip: '' })
watch(
  () => props.client.mac,
  () => {
    const c = props.client
    Object.assign(form, { name: c.host?.name ?? '', reserve: c.reserved, ip: c.host?.ip || c.ip || '' })
  },
  { immediate: true },
)
const ipErr = computed(() => (form.reserve ? ipError(form.ip) : null))
const dirty = computed(() => {
  const c = props.client
  return form.name !== (c.host?.name ?? '') || form.reserve !== c.reserved || (form.reserve && form.ip !== (c.host?.ip ?? ''))
})

const connection = computed(() => {
  const c = props.client
  if (c.link === 'wifi') return `${c.guest ? 'Guest ' : ''}Wi-Fi ${BAND[c.band ?? ''] ?? ''}`.trim()
  if (c.link === 'wired') return c.guest ? 'Guest network' : 'Wired or mesh'
  return 'Not seen recently'
})

async function save(): Promise<void> {
  if (await run('save', () => saveHost(props.client, form.name.trim(), form.reserve ? form.ip.trim() : null), 'Saved')) emit('changed')
}

async function block(v: boolean): Promise<void> {
  const name = props.client.name ?? 'this device'
  if (v) {
    const ok = await ask({
      title: `Block internet for ${name}?`,
      text: 'It stays on your network and can still reach your other devices, but not the internet. New connections stop at once; ones already open may carry on for a minute or two.',
      confirm: 'Block',
      destructive: true,
    })
    if (!ok) return
  }
  if (await run('block', () => setBlocked(props.client, v), v ? `${name} is blocked` : `${name} can use the internet again`)) emit('changed')
}

async function kick(): Promise<void> {
  const ok = await ask({
    title: 'Disconnect from Wi-Fi?',
    text: 'The device is dropped from Wi-Fi. It can rejoin right away if it still has the password; block it or change the password to keep it off.',
    confirm: 'Disconnect',
  })
  if (ok && (await run('kick', () => disconnectWifi(props.client), 'Disconnected'))) emit('changed')
}
</script>

<template>
  <div class="hk-sheet">
    <div class="d-flex align-center ga-4">
      <span class="hk-dev-icon big" :class="{ on: client.online }">
        <HkIcon :name="client.guest ? 'guest' : client.link === 'wifi' ? 'wifi' : 'ethernet'" :size="28" />
      </span>
      <div class="d-flex flex-column" style="min-width: 0">
        <span class="hk-h2" style="font-size: 22px; overflow-wrap: anywhere">{{ client.name ?? 'Unknown device' }}</span>
        <span class="text-muted" style="font-size: 14px">{{ connection }}<template v-if="client.online"> · connected</template></span>
      </div>
    </div>

    <div class="d-flex flex-wrap ga-2">
      <span v-if="client.blocked" class="hk-chip hk-chip--error">Internet blocked</span>
      <span v-if="client.reserved" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />Reserved address</span>
      <span v-if="client.randomMac" class="hk-chip hk-chip--outline" title="Phones use a different made-up address on each network">Private address</span>
    </div>

    <dl class="hk-group hk-facts">
      <div><dt>IP address</dt><dd>{{ client.ip ?? '—' }}</dd></div>
      <div><dt>MAC address</dt><dd>{{ client.mac }}</dd></div>
      <template v-if="client.link === 'wifi'">
        <div><dt>Signal</dt><dd>{{ signalWord(client.signal) }} · {{ signed(client.signal) }} dBm</dd></div>
        <!-- Counters are the access point's: tx is what it sends, i.e. the device's download. -->
        <div><dt>Link speed</dt><dd>↓ {{ rate(client.txRate) }} · ↑ {{ rate(client.rxRate) }}</dd></div>
        <div><dt>Connected for</dt><dd>{{ duration(client.connected) }}</dd></div>
        <div><dt>Data since joining</dt><dd>↓ {{ bytes(client.txBytes) }} · ↑ {{ bytes(client.rxBytes) }}</dd></div>
      </template>
    </dl>

    <div class="d-flex flex-column ga-3">
      <v-text-field v-model="form.name" label="Name" :placeholder="client.name ?? 'Give it a name'" persistent-placeholder hide-details />
      <div class="d-flex align-center ga-3">
        <div class="d-flex flex-column flex-grow-1">
          <span style="font-size: 14px">Always give it the same address</span>
          <span class="hk-label">A DHCP reservation, for port forwards and servers</span>
        </div>
        <M3Switch v-model="form.reserve" label="Reserve an address" />
      </div>
      <v-text-field v-if="form.reserve" v-model="form.ip" label="Address" hide-details="auto" :error-messages="ipErr || undefined" />
      <div class="d-flex justify-end">
        <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !!ipErr" :loading="busy.save" @click="save">Save</v-btn>
      </div>
    </div>

    <v-divider />

    <div class="d-flex align-center ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <span style="font-size: 14px">Block internet</span>
        <span class="hk-label">Keeps local access, stops internet</span>
      </div>
      <M3Switch :model-value="client.blocked" label="Block internet" :busy="busy.block" @update:model-value="block" />
    </div>
    <v-btn v-if="client.link === 'wifi' && client.online" variant="outlined" color="primary" height="40" :loading="busy.kick" style="border-color: rgb(var(--v-theme-outline))" @click="kick">
      Disconnect from Wi-Fi
    </v-btn>
  </div>
</template>

<style scoped>
.hk-sheet {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
}
.hk-dev-icon {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-dev-icon.on {
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-dev-icon.big {
  width: 64px;
  height: 64px;
  border-radius: 32px;
}
.hk-facts {
  margin: 0;
  font-size: 14px;
}
.hk-facts > div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 6px 14px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-facts dt {
  flex-grow: 1;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-facts dd {
  margin: 0;
  font-size: 13px;
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
