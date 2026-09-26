<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SecretField from '@/components/m3/SecretField.vue'
import * as mesh from '@/api/mesh'
import type { CodeCheck, MeshRadio, MeshStatus } from '@/api/mesh'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useNotify } from '@/composables/notify'
import { luciUrl } from '@/nav'

// What this router is in the mesh, and changing it. Gateway = the node with
// the internet; it hands out a join code carrying the mesh name, key,
// channel and width, and satellites join with that code so every node
// matches (a mismatch is the classic "mesh never forms").
const props = defineProps<{ status: MeshStatus; radios: MeshRadio[] }>()
const emit = defineEmits<{ changed: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()
const notify = useNotify()

const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const role = computed(() => props.status.config.applied_role || props.status.config.role)
const usable = computed(() => props.radios.filter((r) => r.mesh_capable))
const pick = ref<'gateway' | 'satellite' | null>(null)

// ---- gateway setup ----
const gw = reactive({ mesh_id: 'HikariMesh', key: '', radio: '' })
onMounted(async () => {
  gw.radio = usable.value.find((r) => r.band === '5g')?.name ?? usable.value[0]?.name ?? ''
  join.radio = gw.radio
  const k = await mesh.genkey().catch(() => null)
  if (k?.ok) gw.key = k.key
})
const gwRadio = computed(() => props.radios.find((r) => r.name === gw.radio) ?? null)
const idOk = computed(() => /^[A-Za-z0-9._-]{1,32}$/.test(gw.mesh_id))
const keyOk = computed(() => /^[A-Za-z0-9._-]{8,64}$/.test(gw.key))

async function makeGateway(): Promise<void> {
  const r = gwRadio.value
  if (!r) return
  const ok = await ask({
    title: 'Make this the main mesh router?',
    text: `The mesh runs on ${BAND[r.band] ?? r.band}, channel ${r.channel}, alongside ${r.aps.map((a) => `“${a.ssid}”`).join(', ') || 'no Wi-Fi network'}. That radio restarts, so its Wi-Fi drops for a few seconds.`,
    confirm: 'Set up',
  })
  if (!ok) return
  const done = await run(
    'gw',
    () => mesh.set({ role: 'gateway', mesh_id: gw.mesh_id, key: gw.key, radio: r.name, channel: String(r.channel), htmode: r.htmode }),
    'Mesh gateway is set up',
  )
  if (done) {
    pick.value = null
    emit('changed')
  }
}

// ---- join ----
const join = reactive({ code: '', radio: '' })
const check = ref<CodeCheck | null>(null)
async function checkCode(): Promise<void> {
  check.value = null
  await run('check', async () => {
    const r = await mesh.codecheck(join.code.trim(), join.radio)
    if (r.ok) check.value = r
    return r
  })
}
function effectText(e: NonNullable<CodeCheck['effects']>[number]): string {
  switch (e.kind) {
    case 'channel_move':
      return `The ${e.radio} radio moves from channel ${e.from} to ${e.to}${e.aps.length ? `, taking ${e.aps.map((a) => `“${a.ssid}”`).join(', ')} with it` : ''}.`
    case 'htmode_change':
      return `Channel width changes from ${e.from ?? 'default'} to ${e.to}.`
    case 'country_change':
      return `Country changes from ${e.from} to ${e.to}.`
    case 'radio_enabled':
      return `The ${e.radio} radio is switched on.`
  }
}
async function doJoin(): Promise<void> {
  const ok = await ask({
    title: `Join “${check.value?.payload?.mesh_id}”?`,
    text: 'This router becomes a satellite of that mesh. The radio restarts, so its Wi-Fi drops for a few seconds.',
    confirm: 'Join',
  })
  if (!ok) return
  if (await run('join', () => mesh.join(join.code.trim(), join.radio), 'Joined the mesh')) {
    pick.value = null
    check.value = null
    emit('changed')
  }
}

// ---- gateway: join code ----
const joinCode = ref('')
async function showCode(): Promise<void> {
  await run('code', async () => {
    const r = await mesh.code()
    if (r.ok) joinCode.value = r.code
    return r
  })
}
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(joinCode.value)
    notify.show('Join code copied')
  } catch {
    notify.show('Select the code and copy it by hand (the browser blocked the clipboard).')
  }
}

async function turnOff(): Promise<void> {
  const ok = await ask({
    title: role.value === 'gateway' ? 'Turn the mesh off?' : 'Leave the mesh?',
    text: role.value === 'gateway' ? 'Satellites lose their connection to this router until the mesh is back on. The mesh key is kept.' : 'This router stops using the mesh backhaul.',
    confirm: role.value === 'gateway' ? 'Turn off' : 'Leave',
    destructive: true,
  })
  if (ok && (await run('off', () => mesh.off(), 'Mesh is off'))) emit('changed')
}
</script>

<template>
  <section class="hk-card" aria-label="Mesh role" style="gap: 14px">
    <!-- Off: choose a role -->
    <template v-if="role === 'off' || !role">
      <h2 class="hk-h2">Set up mesh</h2>
      <p class="text-muted" style="font-size: 14px; margin: 0">Link routers over Wi-Fi so one internet connection covers the whole place.</p>
      <div class="hk-choices">
        <button type="button" class="hk-choice" :class="{ on: pick === 'gateway' }" :aria-pressed="pick === 'gateway' ? 'true' : 'false'" @click="pick = 'gateway'">
          <span class="hk-choice__icon"><HkIcon name="router" :stroke="1.8" /></span>
          <span class="font-weight-bold">Main router</span>
          <span class="hk-label">This one has the internet; others join it</span>
        </button>
        <button type="button" class="hk-choice" :class="{ on: pick === 'satellite' }" :aria-pressed="pick === 'satellite' ? 'true' : 'false'" @click="pick = 'satellite'">
          <span class="hk-choice__icon"><HkIcon name="mesh" /></span>
          <span class="font-weight-bold">Extend a mesh</span>
          <span class="hk-label">Join a main router with its join code</span>
        </button>
      </div>

      <template v-if="pick === 'gateway'">
        <v-text-field v-model="gw.mesh_id" label="Mesh name" hide-details="auto" :error-messages="idOk ? undefined : '1–32 letters, digits, dots, dashes, underscores'" />
        <SecretField v-model="gw.key" label="Mesh key" :error-messages="keyOk ? null : '8–64 letters, digits, dots, dashes, underscores'" hint="Generated for you; satellites get it inside the join code" />
        <v-select v-model="gw.radio" :items="usable.map((r) => ({ value: r.name, title: `${BAND[r.band] ?? r.band} · channel ${r.channel} · ${r.htmode.replace(/^\D+/, '')} MHz` }))" label="Radio" hide-details />
        <p class="hk-label" style="margin: 0">The mesh uses the radio’s current channel, fixed. 5 GHz is faster; every node must be able to use the same channel.</p>
        <div class="d-flex justify-end"><v-btn variant="flat" color="primary" height="40" :disabled="!idOk || !keyOk || !gwRadio" :loading="busy.gw" @click="makeGateway">Set up main router</v-btn></div>
      </template>

      <template v-if="pick === 'satellite'">
        <v-textarea v-model="join.code" label="Join code" rows="3" placeholder="Copy it from Mesh on the main router" persistent-placeholder hide-details spellcheck="false" class="hk-mono" @update:model-value="check = null" />
        <v-select v-model="join.radio" :items="usable.map((r) => ({ value: r.name, title: `${BAND[r.band] ?? r.band} (${r.name})` }))" label="Radio" hide-details @update:model-value="check = null" />
        <div v-if="check" class="hk-effects">
          <div class="font-weight-bold" style="font-size: 14px">Joining “{{ check.payload?.mesh_id }}” will:</div>
          <ul>
            <li v-for="(e, i) in check.effects ?? []" :key="i">{{ effectText(e) }}</li>
            <li v-if="!check.effects?.length">Change nothing else on this router’s Wi-Fi.</li>
          </ul>
        </div>
        <div class="d-flex justify-end ga-2">
          <v-btn v-if="!check" variant="flat" color="secondary-container" height="40" :disabled="!join.code.trim()" :loading="busy.check" @click="checkCode">Check code</v-btn>
          <v-btn v-else variant="flat" color="primary" height="40" :loading="busy.join" @click="doJoin">Join</v-btn>
        </div>
      </template>
    </template>

    <!-- Gateway -->
    <template v-else-if="role === 'gateway'">
      <h2 class="hk-h2">Add a satellite</h2>
      <ol class="hk-steps">
        <li>On the other router, open Mesh and choose <b>Extend a mesh</b>.</li>
        <li>Paste this join code there. It carries the mesh name, key and channel.</li>
      </ol>
      <div v-if="joinCode" class="hk-code">
        <code>{{ joinCode }}</code>
        <v-btn variant="flat" color="primary" height="36" @click="copy">Copy</v-btn>
      </div>
      <v-btn v-else variant="flat" color="secondary-container" height="40" style="align-self: flex-start" :loading="busy.code" @click="showCode">Show join code</v-btn>
      <p class="hk-label" style="margin: 0">Anyone with the code can join your mesh, so share it only with your own routers.</p>
      <div class="d-flex"><v-btn variant="text" color="error" height="40" class="ml-n3" :loading="busy.off" @click="turnOff">Turn mesh off</v-btn></div>
    </template>

    <!-- Satellite -->
    <template v-else>
      <h2 class="hk-h2">Satellite</h2>
      <p class="text-muted" style="font-size: 14px; margin: 0">
        This router extends the “{{ status.config.mesh_id }}” mesh. To run it as a plain access point (no routing of its own), use the
        <a :href="luciUrl('admin/network/mesh')" class="text-primary">advanced mesh settings in LuCI</a>: it changes this router’s address and has its own safety net.
      </p>
      <div class="d-flex"><v-btn variant="text" color="error" height="40" class="ml-n3" :loading="busy.off" @click="turnOff">Leave mesh</v-btn></div>
    </template>
  </section>
</template>

<style scoped>
.hk-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 599.98px) {
  .hk-choices {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hk-choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.hk-choice.on {
  border-color: rgb(var(--v-theme-secondary-container));
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-choice.on .hk-label {
  color: inherit;
}
.hk-choice__icon {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  margin-bottom: 6px;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.hk-choice:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-steps {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hk-code {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-code code {
  flex-grow: 1;
  min-width: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
  background: none;
}
.hk-effects {
  padding: 12px 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
}
.hk-effects ul {
  margin: 6px 0 0;
  padding-left: 20px;
  font-size: 14px;
}
.hk-mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
