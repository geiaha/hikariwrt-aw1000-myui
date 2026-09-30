<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SecretField from '@/components/m3/SecretField.vue'
import { saveWifiShared, type WifiNetwork, type WifiRadio } from '@/api/wifi'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { keyError, ssidError } from '@/utils/validate'

// One name and password for every band, as the setup wizard's "Same name on
// both bands" writes them. Saving puts the same name, security, password and
// hidden flag on each band's network; devices then move between bands by
// themselves. Channel, width and on/off stay per band, on the band cards.
const props = defineProps<{ bands: { radio: WifiRadio; net: WifiNetwork }[] }>()
const emit = defineEmits<{ saved: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const SECURITY = [
  { value: 'sae', title: 'WPA3', subtitle: 'Newest; older devices may not join' },
  { value: 'sae-mixed', title: 'WPA2 / WPA3', subtitle: 'Recommended' },
  { value: 'psk2', title: 'WPA2', subtitle: 'For older devices' },
  { value: 'psk-mixed', title: 'WPA / WPA2', subtitle: 'Legacy devices only' },
  { value: 'none', title: 'None (open)', subtitle: 'Anyone nearby can join' },
]

// Filled from the 5 GHz network (the wizard's primary), else the first band.
const primary = computed(() => props.bands.find((b) => b.radio.band === '5g') ?? props.bands[0]!)
const form = reactive({ ssid: '', key: '', encryption: 'sae-mixed', hidden: false })
function reset(): void {
  const n = primary.value.net
  Object.assign(form, { ssid: n.ssid, key: n.key, encryption: n.encryption, hidden: n.hidden })
}
watch(() => props.bands.map((b) => b.net), reset, { immediate: true })

const names = computed(() => props.bands.map((b) => BAND[b.radio.band] ?? b.radio.band).join(' and '))
const securityItems = computed(() =>
  SECURITY.some((s) => s.value === form.encryption) ? SECURITY : [...SECURITY, { value: form.encryption, title: form.encryption, subtitle: 'Set elsewhere' }],
)
const errors = computed(() => ({ ssid: ssidError(form.ssid), key: keyError(form.key, form.encryption) }))
const valid = computed(() => !errors.value.ssid && !errors.value.key)
// Dirty while any band differs, which is also the case right after switching
// "same name" on for bands that had their own names: saving unifies them.
const differs = (n: WifiNetwork) => n.ssid !== form.ssid || n.key !== form.key || n.encryption !== form.encryption || n.hidden !== form.hidden
const dirty = computed(() => props.bands.some((b) => differs(b.net)))
const unifying = computed(() => new Set(props.bands.map((b) => `${b.net.ssid}\n${b.net.key}`)).size > 1)

async function save(): Promise<void> {
  const answer = await ask({
    title: `Save Wi-Fi on ${names.value}?`,
    text:
      `Devices on this Wi-Fi disconnect and must rejoin${unifying.value || props.bands.some((b) => b.net.ssid !== form.ssid || b.net.key !== form.key) ? ' with the new details' : ''}.\n\n` +
      'Connected over this Wi-Fi yourself? Choose “Apply now” and rejoin. “Apply safely” undoes the change after 30 seconds if the router can’t hear back from you, which is what happens when your own connection drops.',
    confirm: 'Apply safely',
    alt: 'Apply now',
  })
  if (!answer) return
  const values: Record<string, string> = { ssid: form.ssid, encryption: form.encryption }
  const drop: string[] = []
  if (form.encryption === 'none') drop.push('key')
  else values.key = form.key
  if (form.hidden) values.hidden = '1'
  else drop.push('hidden')
  if (await run('save', () => saveWifiShared(props.bands.map((b) => b.net.section), values, drop, answer === true), 'Wi-Fi saved on both bands')) emit('saved')
}
</script>

<template>
  <section class="hk-card" aria-label="Wi-Fi on all bands" style="gap: 14px">
    <div class="d-flex align-center ga-3">
      <span class="hk-band-icon"><HkIcon name="wifi" /></span>
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 class="hk-h2">Wi-Fi</h2>
        <span class="text-muted" style="font-size: 13px">One network on {{ names }}</span>
      </div>
    </div>

    <v-alert v-if="unifying" type="info" variant="tonal" density="compact">
      The bands have different names now. Saving gives them all this name and password.
    </v-alert>

    <v-text-field v-model="form.ssid" label="Network name" hide-details="auto" :error-messages="errors.ssid || undefined" />
    <v-select v-model="form.encryption" :items="securityItems" item-title="title" item-value="value" label="Security" hide-details>
      <template #item="{ props: p, item }">
        <v-list-item v-bind="p" :subtitle="item.subtitle" />
      </template>
    </v-select>
    <SecretField v-if="form.encryption !== 'none'" v-model="form.key" label="Password" :error-messages="errors.key" />
    <v-alert v-else type="warning" variant="tonal" density="compact">Anyone in range can join and see unencrypted traffic.</v-alert>
    <div class="d-flex align-center ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <span style="font-size: 14px">Hide network name</span>
        <span class="hk-label">Devices must type the name to join</span>
      </div>
      <M3Switch v-model="form.hidden" label="Hide network name" />
    </div>

    <div class="d-flex justify-end ga-2">
      <v-btn variant="text" color="primary" height="40" :disabled="!dirty" @click="reset">Undo changes</v-btn>
      <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !valid" :loading="busy.save" @click="save">Save</v-btn>
    </div>
  </section>
</template>

<style scoped>
.hk-band-icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
</style>
