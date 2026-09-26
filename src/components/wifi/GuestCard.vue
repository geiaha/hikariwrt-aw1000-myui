<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SecretField from '@/components/m3/SecretField.vue'
import { createGuest, freeSubnet, removeGuest, updateGuest, type GuestState } from '@/api/guest'
import type { WifiRadio } from '@/api/wifi'
import { setWifiAps } from '@/api/services'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useSession } from '@/stores/session'
import { generatePassword, keyError, ssidError } from '@/utils/validate'

// Guest Wi-Fi: set up in one step (see api/guest.ts for what that creates),
// then name, password, on/off and removal. Guests get internet only: no
// access to your devices, to each other, or to this router beyond DHCP/DNS.
const props = defineProps<{ state: GuestState; radios: WifiRadio[] }>()
const emit = defineEmits<{ changed: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()
const session = useSession()

const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const bandOf = (radio: string) => BAND[props.radios.find((r) => r.name === radio)?.band ?? ''] ?? radio
const SECURITY = [
  { value: 'sae-mixed', title: 'WPA2 / WPA3' },
  { value: 'psk2', title: 'WPA2' },
  { value: 'none', title: 'None (open)' },
]

// ---- setup ----
const setup = reactive({ ssid: '', key: generatePassword(), encryption: 'sae-mixed', radios: [] as string[] })
const prefix = ref<string | null>(null)
onMounted(async () => {
  setup.ssid = `${session.board?.hostname ?? 'HikariWrt'} Guest`
  setup.radios = props.radios.filter((r) => !r.disabled).map((r) => r.name)
  if (!props.state.exists) prefix.value = await freeSubnet().catch(() => null)
})
const setupErrors = computed(() => ({
  ssid: ssidError(setup.ssid),
  key: keyError(setup.key, setup.encryption),
  radios: setup.radios.length ? null : 'Pick at least one band',
}))
const setupValid = computed(() => Object.values(setupErrors.value).every((e) => !e) && !!prefix.value)

async function create(): Promise<void> {
  const ok = await ask({
    title: 'Create the guest network?',
    text: `Adds “${setup.ssid}” on ${setup.radios.map(bandOf).join(' and ')}, with its own addresses (${prefix.value}.x) and a firewall zone that only reaches the internet.\n\nWi-Fi on those bands and the firewall restart, so devices drop for a few seconds. If the router can’t hear back from you within a minute, it undoes the whole setup.`,
    confirm: 'Create',
  })
  if (!ok) return
  if (await run('create', () => createGuest({ ...setup, prefix: prefix.value! }), 'Guest Wi-Fi is on')) emit('changed')
}

// ---- existing ----
const aps = computed(() => props.state.aps)
const on = computed(() => aps.value.some((a) => !a.disabled))
const radiosOf = computed(() => props.radios.filter((r) => aps.value.some((a) => a.radio === r.name)))
const nets = computed(() => radiosOf.value.flatMap((r) => r.networks.filter((n) => aps.value.some((a) => a.section === n.section))))
const clients = computed(() => nets.value.reduce((a, n) => a + n.clients, 0))

const edit = reactive({ ssid: '', key: '', encryption: 'sae-mixed' })
function reset(): void {
  const n = nets.value[0]
  Object.assign(edit, { ssid: n?.ssid ?? '', key: n?.key ?? '', encryption: n?.encryption ?? 'sae-mixed' })
}
watch(nets, reset, { immediate: true })
const dirty = computed(() => {
  const n = nets.value[0]
  return !!n && (edit.ssid !== n.ssid || edit.key !== n.key || edit.encryption !== n.encryption)
})
const editErrors = computed(() => ({ ssid: ssidError(edit.ssid), key: keyError(edit.key, edit.encryption) }))

async function save(): Promise<void> {
  const answer = await ask({
    title: 'Save guest Wi-Fi?',
    text: 'Guests disconnect and rejoin with the new details. Connected over the guest network yourself? Choose “Apply now”.',
    confirm: 'Apply safely',
    alt: 'Apply now',
  })
  if (!answer) return
  const secs = aps.value.map((a) => a.section)
  if (await run('save', () => updateGuest(secs, edit.ssid, edit.encryption, edit.key, answer === true), 'Guest Wi-Fi saved')) emit('changed')
}

async function toggle(v: boolean): Promise<void> {
  const secs = aps.value.map((a) => a.section)
  if (await run('toggle', () => setWifiAps(secs, v), `Guest Wi-Fi turned ${v ? 'on' : 'off'}`)) emit('changed')
}

async function remove(): Promise<void> {
  const ok = await ask({
    title: 'Remove the guest network?',
    text: 'The guest Wi-Fi, its addresses and its firewall zone are deleted. Guests are disconnected. Wi-Fi and the firewall restart for a few seconds.',
    confirm: 'Remove',
    destructive: true,
  })
  if (ok && (await run('remove', () => removeGuest(), 'Guest network removed'))) emit('changed')
}
</script>

<template>
  <section class="hk-card" aria-label="Guest Wi-Fi" style="gap: 14px">
    <div class="d-flex align-center ga-3">
      <span class="hk-guest-icon" :class="{ off: state.exists && !on }"><HkIcon name="guest" /></span>
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 class="hk-h2">Guest Wi-Fi</h2>
        <span class="text-muted" style="font-size: 13px">
          <template v-if="!state.exists">Not set up</template>
          <template v-else-if="!on">Off</template>
          <template v-else>{{ clients }} {{ clients === 1 ? 'guest' : 'guests' }} · {{ radiosOf.map((r) => BAND[r.band]).join(' + ') }} · {{ state.subnet }}</template>
        </span>
      </div>
      <M3Switch v-if="state.exists" :model-value="on" label="Guest Wi-Fi" :busy="busy.toggle" @update:model-value="toggle" />
    </div>

    <!-- Setup -->
    <template v-if="!state.exists">
      <p class="text-muted" style="font-size: 14px; margin: 0">
        A separate network for visitors. They get internet, but can’t see your devices, each other, or this router’s settings.
      </p>
      <v-text-field v-model="setup.ssid" label="Network name" hide-details="auto" :error-messages="setupErrors.ssid || undefined" />
      <v-select v-model="setup.encryption" :items="SECURITY" label="Security" hide-details />
      <div v-if="setup.encryption !== 'none'" class="d-flex align-start ga-2">
        <SecretField v-model="setup.key" label="Password" :error-messages="setupErrors.key" class="flex-grow-1" />
        <v-btn icon variant="text" width="56" height="56" aria-label="Make a new password" title="Make a new password" @click="setup.key = generatePassword()">
          <HkIcon name="refresh" />
        </v-btn>
      </div>
      <div>
        <div class="hk-label mb-2">Bands</div>
        <div class="d-flex flex-wrap ga-2" role="group" aria-label="Bands">
          <button
            v-for="r in radios"
            :key="r.name"
            type="button"
            class="hk-filter"
            :class="{ 'is-on': setup.radios.includes(r.name) }"
            :aria-pressed="setup.radios.includes(r.name) ? 'true' : 'false'"
            @click="setup.radios = setup.radios.includes(r.name) ? setup.radios.filter((x) => x !== r.name) : [...setup.radios, r.name]"
          >
            <HkIcon v-if="setup.radios.includes(r.name)" name="check" :size="16" :stroke="2.6" />{{ BAND[r.band] ?? r.band }}
          </button>
        </div>
        <div v-if="setupErrors.radios" class="text-error mt-1" style="font-size: 12px">{{ setupErrors.radios }}</div>
      </div>
      <span v-if="prefix" class="hk-label">Guests get addresses {{ prefix }}.100 – {{ prefix }}.249</span>
      <div class="d-flex justify-end">
        <v-btn variant="flat" color="primary" height="40" :disabled="!setupValid" :loading="busy.create" @click="create">Create guest network</v-btn>
      </div>
    </template>

    <!-- Existing -->
    <template v-else>
      <v-text-field v-model="edit.ssid" label="Network name" hide-details="auto" :error-messages="editErrors.ssid || undefined" />
      <v-select v-model="edit.encryption" :items="SECURITY" label="Security" hide-details />
      <SecretField v-if="edit.encryption !== 'none'" v-model="edit.key" label="Password" :error-messages="editErrors.key" />
      <div class="d-flex flex-wrap justify-end ga-2">
        <v-btn variant="text" color="error" height="40" :loading="busy.remove" @click="remove">Remove</v-btn>
        <v-spacer />
        <v-btn variant="text" color="primary" height="40" :disabled="!dirty" @click="reset">Undo changes</v-btn>
        <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !!editErrors.ssid || !!editErrors.key" :loading="busy.save" @click="save">Save</v-btn>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hk-guest-icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
}
.hk-guest-icon.off {
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-filter {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-on-surface-muted));
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.hk-filter.is-on {
  padding-left: 8px;
  border-color: rgb(var(--v-theme-secondary-container));
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
</style>
