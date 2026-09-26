<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SecretField from '@/components/m3/SecretField.vue'
import { saveWifi, type WifiNetwork, type WifiRadio } from '@/api/wifi'
import { setWifiAp } from '@/api/services'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { keyError, ssidError } from '@/utils/validate'

// One band: its main network (name, password, security, hidden) and the
// radio (channel, width). When aw1000-mesh uses the radio, channel and
// width belong to the mesh (every node must move together), so they are
// shown but changed on the Mesh page.
const props = defineProps<{ radio: WifiRadio; net: WifiNetwork }>()
const emit = defineEmits<{ saved: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const title = computed(() => BAND[props.radio.band] ?? props.radio.band)

const SECURITY = [
  { value: 'sae', title: 'WPA3', subtitle: 'Newest; older devices may not join' },
  { value: 'sae-mixed', title: 'WPA2 / WPA3', subtitle: 'Recommended' },
  { value: 'psk2', title: 'WPA2', subtitle: 'For older devices' },
  { value: 'psk-mixed', title: 'WPA / WPA2', subtitle: 'Legacy devices only' },
  { value: 'none', title: 'None (open)', subtitle: 'Anyone nearby can join' },
]

const form = reactive({ ssid: '', key: '', encryption: 'sae-mixed', hidden: false, channel: 'auto', htmode: '' })
function reset(): void {
  Object.assign(form, {
    ssid: props.net.ssid,
    key: props.net.key,
    encryption: props.net.encryption,
    hidden: props.net.hidden,
    channel: props.radio.channel,
    htmode: props.radio.htmode,
  })
}
watch(() => [props.net, props.radio], reset, { immediate: true })

const securityItems = computed(() =>
  SECURITY.some((s) => s.value === props.net.encryption) ? SECURITY : [...SECURITY, { value: props.net.encryption, title: props.net.encryption, subtitle: 'Set elsewhere' }],
)
const channelItems = computed(() => [
  { value: 'auto', title: 'Automatic' },
  ...props.radio.channels.map((c) => ({ value: String(c.channel), title: `${c.channel} · ${c.mhz} MHz` })),
])
const widthItems = computed(() => props.radio.htmodes.map((h) => ({ value: h, title: `${h.replace(/^\D+/, '')} MHz` })))

const errors = computed(() => ({ ssid: ssidError(form.ssid), key: keyError(form.key, form.encryption) }))
const valid = computed(() => !errors.value.ssid && !errors.value.key)
const netDirty = computed(() => form.ssid !== props.net.ssid || form.key !== props.net.key || form.encryption !== props.net.encryption || form.hidden !== props.net.hidden)
const radioDirty = computed(() => form.channel !== props.radio.channel || form.htmode !== props.radio.htmode)

async function save(): Promise<void> {
  let safe = true
  if (netDirty.value) {
    const answer = await ask({
      title: `Save ${title.value} Wi-Fi?`,
      text:
        `Devices on “${props.net.ssid}” disconnect and must rejoin${form.ssid !== props.net.ssid || form.key !== props.net.key ? ' with the new details' : ''}.\n\n` +
        'Connected over this Wi-Fi yourself? Choose “Apply now” and rejoin. “Apply safely” undoes the change after 30 seconds if the router can’t hear back from you, which is what happens when your own connection drops.',
      confirm: 'Apply safely',
      alt: 'Apply now',
    })
    if (!answer) return
    safe = answer === true
  } else {
    const ok = await ask({
      title: `Change the ${title.value} radio?`,
      text: 'Wi-Fi on this band restarts, so devices drop for a few seconds. If the router can’t hear back from you within 30 seconds, it undoes the change.',
      confirm: 'Apply',
    })
    if (!ok) return
  }
  const values: Record<string, string> = {}
  const drop: string[] = []
  if (netDirty.value) {
    values.ssid = form.ssid
    values.encryption = form.encryption
    if (form.encryption === 'none') drop.push('key')
    else values.key = form.key
    if (form.hidden) values.hidden = '1'
    else drop.push('hidden')
  }
  const radioValues: Record<string, string> = {}
  if (radioDirty.value && !props.radio.meshOwned) {
    radioValues.channel = form.channel
    if (form.htmode) radioValues.htmode = form.htmode
  }
  if (await run('save', () => saveWifi({ radio: props.radio.name, radioValues, section: props.net.section, values, drop }, safe), `${title.value} Wi-Fi saved`)) emit('saved')
}

async function toggle(on: boolean): Promise<void> {
  if (!on) {
    const ok = await ask({
      title: `Turn off ${title.value} Wi-Fi?`,
      text: `Devices on “${props.net.ssid}” disconnect. If this browser is connected over it, the router turns it back on after 30 seconds.`,
      confirm: 'Turn off',
    })
    if (!ok) return
  }
  if (await run('toggle', () => setWifiAp(props.net.section, on), `${title.value} Wi-Fi turned ${on ? 'on' : 'off'}`)) emit('saved')
}
</script>

<template>
  <section class="hk-card" :aria-label="`${title} Wi-Fi`" style="gap: 14px">
    <div class="d-flex align-center ga-3">
      <span class="hk-band-icon" :class="{ off: net.disabled }"><HkIcon name="wifi" /></span>
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 class="hk-h2">{{ title }}</h2>
        <span class="text-muted" style="font-size: 13px">
          <template v-if="net.disabled">Off</template>
          <template v-else>{{ net.clients }} {{ net.clients === 1 ? 'device' : 'devices' }} · channel {{ radio.channel }} · {{ radio.htmode.replace(/^\D+/, '') }} MHz</template>
        </span>
      </div>
      <M3Switch :model-value="!net.disabled" :label="`${title} Wi-Fi`" :busy="busy.toggle" @update:model-value="toggle" />
    </div>

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

    <div class="hk-radio">
      <v-select v-model="form.channel" :items="channelItems" label="Channel" hide-details :disabled="radio.meshOwned" />
      <v-select v-model="form.htmode" :items="widthItems" label="Channel width" hide-details :disabled="radio.meshOwned || !widthItems.length" />
    </div>
    <p v-if="radio.meshOwned" class="hk-label" style="margin: 0">
      Mesh uses this radio, so its channel is set on the <router-link to="/mesh" class="text-primary">Mesh page</router-link>; every node has to move together.
    </p>
    <p v-else class="hk-label" style="margin: 0">Country {{ radio.country || 'not set' }}<template v-if="radio.txpower != null"> · {{ radio.txpower }} dBm</template></p>

    <div class="d-flex justify-end ga-2">
      <v-btn variant="text" color="primary" height="40" :disabled="!netDirty && !radioDirty" @click="reset">Undo changes</v-btn>
      <v-btn variant="flat" color="primary" height="40" :disabled="(!netDirty && !(radioDirty && !radio.meshOwned)) || !valid" :loading="busy.save" @click="save">Save</v-btn>
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
.hk-band-icon.off {
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-radio {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 599.98px) {
  .hk-radio {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
