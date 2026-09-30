<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import * as modem from '@/api/modem'
import type { Ipv6Info, ProfileInfo } from '@/api/modem'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useNotify } from '@/composables/notify'
import { luciUrl } from '@/nav'

// APN, TTL and an IPv6 summary. An APN change reconnects the uplink and
// aw1000-modem arms a watchdog: if no address comes up within apn_verify
// seconds it puts the old settings back. We poll profileinfo until the
// watchdog says ok or rolled_back, so the page tells you which happened.
// IPv6 setup (styles, NAT64, delegation) stays in LuCI for now.

const { busy, run } = useAction()
const { ask } = useConfirm()
const notify = useNotify()

const info = ref<ProfileInfo | null>(null)
const v6 = ref<Ipv6Info | null>(null)
const verifying = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

type Mode = 'auto' | 'list' | 'custom'
const mode = ref<Mode>('custom')
const carrier = ref('')
const apn = ref('')
const auth = ref('none')
const username = ref('')
const password = ref('')
const pdptype = ref('')
const ttlOn = ref(false)
// 64: the rule sets the value on the way out, after forwarding has taken its
// hop off, so the carrier sees exactly this - and 64 is what a phone sends.
const ttl = ref(64)

function fill(p: ProfileInfo): void {
  info.value = p
  const m = p.apn.mode
  mode.value = m === 'auto' || m === 'list' ? m : 'custom'
  carrier.value = p.apn.carrier
  apn.value = p.apn.value
  auth.value = p.apn.auth || 'none'
  username.value = p.apn.username
  password.value = ''
  pdptype.value = p.apn.pdptype || ''
  ttlOn.value = p.ttl.value > 0
  if (p.ttl.value > 0) ttl.value = p.ttl.value
}

onMounted(async () => {
  const [p, i] = await Promise.all([modem.profileinfo().catch(() => null), modem.ipv6info().catch(() => null)])
  if (p?.ok) fill(p)
  v6.value = i
  if (p?.verify.state === 'pending' && p.verify.at && Date.now() / 1000 - p.verify.at < p.apn_verify + 30) watchVerify()
})
onBeforeUnmount(() => clearTimeout(timer))

const carriers = computed(() => (info.value?.carriers ?? []).map((c) => ({ value: c.id, title: `${c.name} · ${c.apn}`, raw: c })))
watch(carrier, (id) => {
  const c = info.value?.carriers?.find((x) => x.id === id)
  if (c && mode.value === 'list') {
    apn.value = c.apn
    auth.value = c.auth || 'none'
  }
})

const apnOk = computed(() => mode.value === 'auto' || /^[A-Za-z0-9._-]+$/.test(apn.value.trim()))

async function saveApn(): Promise<void> {
  const row = info.value?.carriers?.find((c) => c.id === carrier.value)
  if (mode.value === 'list' && !row) return notify.show('Pick a carrier from the list.')
  const args =
    mode.value === 'auto'
      ? { mode: 'auto', apn: '', auth: 'none', username: '', password: '', pdptype: '', carrier: '' }
      : mode.value === 'list'
        ? { mode: 'list', apn: row!.apn, auth: row!.auth || 'none', username: row!.username ?? '', password: row!.password ?? '', pdptype: row!.pdptype ?? '', carrier: row!.id }
        : { mode: 'custom', apn: apn.value.trim(), auth: auth.value, username: username.value.trim(), password: password.value, pdptype: pdptype.value, carrier: '' }
  const dropsPassword = mode.value === 'custom' && !!info.value?.apn.has_password && !password.value
  const ok = await ask({
    title: 'Change the APN?',
    text:
      `The 5G uplink reconnects with the new settings. If it gets no address within ${info.value?.apn_verify ?? 45} seconds, the router puts the old settings back on its own.` +
      (dropsPassword ? '\n\nThe stored password will be removed, because the password field is empty.' : ''),
    confirm: 'Change',
  })
  if (!ok) return
  let reply: modem.WriteReply<ProfileInfo> | null = null
  const done = await run('apn', async () => (reply = await modem.setApn(args)))
  if (!done || !reply) return
  const r = reply as modem.WriteReply<ProfileInfo>
  if (r.state?.ok) fill(r.state)
  if (r.changed === false) notify.show('Nothing changed.')
  else watchVerify()
}

function watchVerify(): void {
  verifying.value = true
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const p = await modem.profileinfo().catch(() => null)
    if (p?.ok) info.value = p
    const st = p?.verify.state
    if (st === 'ok') {
      verifying.value = false
      notify.show('The new APN works: the uplink has an address.')
    } else if (st === 'rolled_back') {
      verifying.value = false
      if (p) fill(p)
      notify.show('No address with the new APN, so the old settings are back.', 8000)
    } else watchVerify()
  }, 5000)
}

async function saveTtl(): Promise<void> {
  const v = ttlOn.value ? Math.round(ttl.value) : 0
  if (ttlOn.value && (v < 1 || v > 255)) return notify.show('TTL is a number from 1 to 255.')
  let r: modem.WriteReply<ProfileInfo> | null = null
  if (await run('ttl', async () => (r = await modem.setTtl(v)), v ? `Outgoing TTL set to ${v}` : 'TTL rewrite turned off')) {
    const reply = r as modem.WriteReply<ProfileInfo> | null
    if (reply?.state?.ok) fill(reply.state)
  }
}

const ttlDirty = computed(() => !!info.value && (ttlOn.value ? Math.round(ttl.value) : 0) !== info.value.ttl.value)
const V6: Record<string, string> = { dual: 'IPv4 and IPv6', split: 'IPv4 and IPv6 (separate calls)', v6only: 'IPv6 only', v4only: 'IPv4 only' }
</script>

<template>
  <div class="hk-grid-3 hk-apn">
    <section class="hk-card hk-apn__main" aria-label="APN" style="gap: 14px">
      <div class="d-flex align-center flex-wrap ga-3">
        <div class="d-flex flex-column flex-grow-1">
          <h2 class="hk-h2">Access point (APN)</h2>
          <span class="text-muted" style="font-size: 13px">
            <template v-if="info">In use: {{ info.apn.modem_context || info.apn.value || 'chosen by the network' }}</template>
          </span>
        </div>
        <span v-if="verifying" class="hk-chip hk-chip--outline"><v-progress-circular indeterminate size="14" width="2" />Checking the new APN…</span>
        <span v-else-if="info?.verify.state === 'rolled_back'" class="hk-chip hk-chip--error">Last change was rolled back</span>
      </div>
      <template v-if="info">
        <SegmentedButton
          v-model="mode"
          label="How the APN is chosen"
          :options="[
            { value: 'auto', label: 'Automatic' },
            { value: 'list', label: 'From list' },
            { value: 'custom', label: 'Custom' },
          ]"
        />
        <p v-if="mode === 'auto'" class="text-muted" style="font-size: 14px">No APN is set; the network and SIM pick one. Works for most carriers.</p>
        <v-select v-else-if="mode === 'list'" v-model="carrier" :items="carriers" :label="`Carriers for MCC ${info.mcc}`" hide-details
          :no-data-text="'No carriers listed for this country'" />
        <template v-else>
          <v-text-field v-model="apn" label="APN" autocomplete="off" hide-details="auto" :error-messages="apn && !apnOk ? 'Letters, digits, dots, dashes and underscores only' : undefined" />
          <div class="hk-apn__row">
            <v-select v-model="auth" :items="[{ value: 'none', title: 'None' }, { value: 'pap', title: 'PAP' }, { value: 'chap', title: 'CHAP' }]" label="Authentication" hide-details />
            <v-select v-model="pdptype" :items="[{ value: '', title: 'Leave as is' }, { value: 'ipv4', title: 'IPv4' }, { value: 'ipv6', title: 'IPv6' }, { value: 'ipv4v6', title: 'IPv4 and IPv6' }]" label="IP type" hide-details />
          </div>
          <div v-if="auth !== 'none'" class="hk-apn__row">
            <v-text-field v-model="username" label="Username" autocomplete="off" hide-details />
            <v-text-field v-model="password" label="Password" type="password" autocomplete="new-password" hide-details="auto"
              :hint="info.apn.has_password ? 'A password is stored. Leave empty to remove it.' : undefined" persistent-hint />
          </div>
        </template>
        <div class="d-flex justify-end">
          <v-btn variant="flat" color="primary" height="40" :disabled="!apnOk || verifying" :loading="busy.apn" @click="saveApn">Save APN</v-btn>
        </div>
      </template>
      <v-skeleton-loader v-else type="text@3" bg-color="transparent" />
    </section>

    <div class="d-flex flex-column ga-4">
      <section class="hk-card" aria-label="TTL" style="gap: 14px">
        <div class="d-flex align-center ga-3">
          <div class="d-flex flex-column flex-grow-1">
            <h2 class="hk-h2">Fixed TTL</h2>
            <span class="text-muted" style="font-size: 13px">Rewrites the TTL of traffic leaving over 5G, so tethering limits can't tell devices apart.</span>
          </div>
          <M3Switch v-model="ttlOn" label="Fixed TTL" :disabled="!info" />
        </div>
        <v-text-field v-if="ttlOn" v-model.number="ttl" type="number" min="1" max="255" label="TTL" hint="64 matches a phone's own traffic" persistent-hint />
        <div v-if="info && info.ttl.value > 0" class="d-flex flex-column ga-1">
          <span class="hk-label">
            <template v-if="info.ttl.active">Working on {{ info.ttl.device || info.ttl.pattern }}<template v-if="info.ttl.packets != null"> · {{ info.ttl.packets.toLocaleString() }} packets rewritten</template></template>
            <template v-else>The rule isn’t covering the 5G connection right now. Save again, or check the firewall.</template>
          </span>
          <span v-if="info.ttl.paused_for_ttl" class="hk-label">Hardware offload is paused while 5G is up, so every packet gets the new TTL.</span>
        </div>
        <div class="d-flex justify-end">
          <v-btn variant="flat" color="primary" height="40" :disabled="!ttlDirty" :loading="busy.ttl" @click="saveTtl">Save</v-btn>
        </div>
      </section>

      <section class="hk-card" aria-label="IPv6" style="gap: 12px">
        <div class="d-flex align-center ga-2">
          <h2 class="hk-h2 flex-grow-1">IPv6</h2>
          <span v-if="v6" class="hk-chip" :class="v6.call.ipv6 ? 'hk-chip--tonal' : 'hk-chip--outline'">
            <HkIcon v-if="v6.call.ipv6" name="check" :size="14" />{{ v6.call.ipv6 ? 'Connected' : 'Not in use' }}
          </span>
        </div>
        <template v-if="v6">
          <dl class="hk-group hk-v6">
            <div><dt>Asks the carrier for</dt><dd>{{ V6[v6.config.style] ?? v6.config.style }}</dd></div>
            <div><dt>IPv6 address</dt><dd>{{ v6.call.ipv6 ? `${v6.call.ipv6}/${v6.call.ipv6_length}` : '—' }}</dd></div>
            <div><dt>LAN prefix</dt><dd>{{ v6.call.prefix ? `${v6.call.prefix}/${v6.call.prefix_length}` : '—' }}</dd></div>
          </dl>
          <p class="text-muted" style="font-size: 13px; margin: 0">{{ v6.assessment.text }}</p>
        </template>
        <v-skeleton-loader v-else type="text@3" bg-color="transparent" />
        <a :href="luciUrl('admin/modem/profiles')" class="hk-link">IPv6 settings in LuCI <HkIcon name="advanced" :size="16" /></a>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hk-apn__main {
  grid-column: span 2;
}
@media (max-width: 1279.98px) {
  .hk-apn__main {
    grid-column: auto;
  }
  .hk-apn {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hk-apn__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 599.98px) {
  .hk-apn__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hk-v6 {
  margin: 0;
  font-size: 14px;
}
.hk-v6 > div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 6px 14px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-v6 dt {
  color: rgb(var(--v-theme-on-surface-muted));
  flex-grow: 1;
}
.hk-v6 dd {
  margin: 0;
  font-size: 13px;
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
