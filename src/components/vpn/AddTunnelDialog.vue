<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import HkIcon from '@/components/icons/HkIcon.vue'
import SecretField from '@/components/m3/SecretField.vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import * as vpn from '@/api/vpn'
import { useAction } from '@/composables/action'
import { useNotify } from '@/composables/notify'

// Add a tunnel: import the .conf a VPN provider gives you (most people), or
// type the fields (self-hosted servers). Either way it arrives disabled with
// routing off, so nothing changes for anyone until you say so.
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ added: [] }>()
const { xs } = useDisplay()
const { busy, run } = useAction()
const notify = useNotify()

const how = ref<'import' | 'manual'>('import')
const label = ref('')
const conf = ref('')
const m = reactive({ private_key: '', public_key_mine: '', addresses: '', public_key: '', allowed_ips: '0.0.0.0/0, ::/0', endpoint_host: '', endpoint_port: '51820', preshared_key: '', keepalive: '25', mtu: '', listen_port: '' })

watch(open, (v) => {
  if (!v) return
  label.value = ''
  conf.value = ''
  Object.assign(m, { private_key: '', public_key_mine: '', addresses: '', public_key: '', endpoint_host: '', preshared_key: '' })
})

async function pickFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  conf.value = await f.text()
  if (!label.value) label.value = f.name.replace(/\.conf$/i, '')
}

async function keypair(): Promise<void> {
  const k = await vpn.genkey().catch(() => null)
  if (!k?.ok) return notify.show('Could not generate keys on the router.')
  m.private_key = k.private_key
  m.public_key_mine = k.public_key
}

const KEY = /^[A-Za-z0-9+/]{42}[A-Za-z0-9+/=]{2}$/
const list = (s: string) => s.split(/[\s,]+/).filter(Boolean).join(' ')
const valid = computed(() => {
  if (!label.value.trim()) return false
  if (how.value === 'import') return /\[Interface\]/i.test(conf.value) && /\[Peer\]/i.test(conf.value)
  return KEY.test(m.private_key) && KEY.test(m.public_key) && !!m.addresses.trim() && !!m.allowed_ips.trim() && !!m.endpoint_host.trim()
})

async function add(): Promise<void> {
  const ok = await run(
    'add',
    () =>
      how.value === 'import'
        ? vpn.importConf(label.value.trim(), conf.value)
        : vpn.create({
            label: label.value.trim(),
            private_key: m.private_key,
            addresses: list(m.addresses),
            public_key: m.public_key,
            allowed_ips: list(m.allowed_ips),
            endpoint_host: m.endpoint_host.trim(),
            endpoint_port: m.endpoint_port.trim(),
            preshared_key: m.preshared_key.trim(),
            keepalive: m.keepalive.trim(),
            mtu: m.mtu.trim(),
            listen_port: m.listen_port.trim(),
          }),
    'Tunnel added. Turn it on and choose who uses it.',
  )
  if (ok) {
    open.value = false
    emit('added')
  }
}
</script>

<template>
  <v-dialog v-model="open" :fullscreen="xs" max-width="620" scrollable>
    <v-card color="surface-container-high" :rounded="xs ? 0 : 'xl'">
      <div class="d-flex align-center ga-3 pa-6 pb-2">
        <h2 class="hk-h2 flex-grow-1" style="font-size: 24px">Add a WireGuard tunnel</h2>
        <v-btn icon variant="text" aria-label="Close" @click="open = false"><HkIcon name="close" /></v-btn>
      </div>
      <v-card-text class="d-flex flex-column ga-4 px-6">
        <SegmentedButton
          v-model="how"
          label="How to add it"
          :options="[
            { value: 'import', label: 'Import a config file' },
            { value: 'manual', label: 'Enter details' },
          ]"
        />
        <v-text-field v-model="label" label="Name" placeholder="e.g. Proton Singapore" persistent-placeholder hide-details />

        <template v-if="how === 'import'">
          <p class="text-muted" style="font-size: 14px; margin: 0">
            Your VPN provider’s WireGuard download (a <code>.conf</code> file). Pick the file or paste its contents.
          </p>
          <label class="hk-file">
            <HkIcon name="advanced" :size="18" style="transform: rotate(180deg)" />
            Choose a .conf file
            <input type="file" accept=".conf,text/plain" class="hk-sr-only" @change="pickFile" />
          </label>
          <v-textarea v-model="conf" label="Config" rows="7" placeholder="[Interface]&#10;PrivateKey = …&#10;Address = …&#10;&#10;[Peer]&#10;PublicKey = …&#10;Endpoint = …" persistent-placeholder class="hk-mono" hide-details spellcheck="false" />
        </template>

        <template v-else>
          <div class="hk-label" style="font-size: 13px">This router</div>
          <div class="d-flex align-start ga-2">
            <SecretField v-model="m.private_key" label="Private key" class="flex-grow-1" />
            <v-btn variant="flat" color="secondary-container" height="56" @click="keypair">Generate</v-btn>
          </div>
          <v-alert v-if="m.public_key_mine" type="info" variant="tonal" density="compact">
            Give the server this public key: <code style="overflow-wrap: anywhere">{{ m.public_key_mine }}</code>
          </v-alert>
          <v-text-field v-model="m.addresses" label="Tunnel address" placeholder="10.2.0.2/32" persistent-placeholder hide-details />
          <div class="hk-label" style="font-size: 13px">Server</div>
          <v-text-field v-model="m.public_key" label="Server public key" hide-details spellcheck="false" />
          <div class="d-flex ga-3">
            <v-text-field v-model="m.endpoint_host" label="Server address" placeholder="vpn.example.com" persistent-placeholder hide-details class="flex-grow-1" />
            <v-text-field v-model="m.endpoint_port" label="Port" inputmode="numeric" hide-details style="max-width: 120px" />
          </div>
          <v-text-field v-model="m.allowed_ips" label="Allowed IPs" hint="0.0.0.0/0, ::/0 sends everything; list subnets for a site-to-site link" persistent-hint />
          <div class="d-flex ga-3">
            <SecretField v-model="m.preshared_key" label="Preshared key (optional)" class="flex-grow-1" />
            <v-text-field v-model="m.keepalive" label="Keepalive (s)" inputmode="numeric" hide-details style="max-width: 140px" />
          </div>
        </template>
      </v-card-text>
      <div class="d-flex justify-end ga-2 pa-6 pt-2">
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn variant="flat" color="primary" :disabled="!valid" :loading="busy.add" @click="add">Add tunnel</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.hk-file {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px 0 14px;
  border-radius: 20px;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.hk-file:focus-within {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
