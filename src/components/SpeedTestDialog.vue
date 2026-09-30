<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import HkIcon from '@/components/icons/HkIcon.vue'
import * as svc from '@/api/services'
import { useUi } from '@/stores/ui'
import { useNotify } from '@/composables/notify'

// Speed test over a chosen uplink, via aw1000-speedtest (Ookla CLI on the
// router, so the result is the router's line, not this browser's Wi-Fi).
// Status is polled once a second only while this dialog is open and a test
// is running.

const ui = useUi()
const notify = useNotify()
const { xs } = useDisplay()

const status = ref<svc.SpeedStatus | null>(null)
const ifaces = ref<svc.SpeedIface[]>([])
const iface = ref<string>('')
const error = ref('')
const starting = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const open = computed({ get: () => ui.speedTest, set: (v) => (ui.speedTest = v) })
const run = computed(() => (status.value?.running ? status.value.run : null))
const last = computed(() =>
  [...(status.value?.results ?? [])].sort((a, b) => b.started - a.started)[0] ?? null,
)

const mbps = (bps: number | null | undefined) => (bps == null ? '—' : ((bps * 8) / 1e6).toFixed(bps * 8 >= 1e8 ? 0 : 1))
const STAGE: Record<string, string> = { starting: 'Starting', ping: 'Latency', download: 'Download', upload: 'Upload' }

async function load(): Promise<void> {
  error.value = ''
  try {
    const [st, li] = await Promise.all([svc.speedStatus(), svc.speedInterfaces()])
    status.value = st
    ifaces.value = li.interfaces
    const want = ui.speedIface
    const pick = li.interfaces.find((i) => i.name === want && i.available) ?? li.interfaces.find((i) => i.device === li.default_device && i.available) ?? li.interfaces.find((i) => i.available)
    iface.value = pick?.name ?? ''
    if (st.running) poll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function poll(): void {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      status.value = await svc.speedStatus()
    } catch {
      /* keep the last view; next tick retries */
    }
    if (open.value && status.value?.running) poll()
  }, 1000)
}

async function start(): Promise<void> {
  starting.value = true
  try {
    if (status.value && !status.value.accepted) await svc.speedAccept()
    const r = await svc.speedStart(iface.value)
    if (!r.ok) throw new Error(r.error || 'The test did not start.')
    status.value = await svc.speedStatus()
    poll()
  } catch (e) {
    notify.show(e instanceof Error ? e.message : String(e), 6000)
  } finally {
    starting.value = false
  }
}

async function cancel(): Promise<void> {
  await svc.speedCancel().catch(() => undefined)
  status.value = await svc.speedStatus().catch(() => status.value)
}

watch(open, (v) => (v ? load() : clearTimeout(timer)))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <v-dialog v-model="open" :fullscreen="xs" max-width="520">
    <v-card color="surface-container-high" :rounded="xs ? 0 : 'xl'" class="pa-6 d-flex flex-column ga-5">
      <div class="d-flex align-center ga-3">
        <span class="hk-st-icon"><HkIcon name="speed" /></span>
        <h2 class="hk-h2 flex-grow-1" style="font-size: 24px">Speed test</h2>
        <v-btn icon variant="text" aria-label="Close" @click="open = false"><HkIcon name="close" /></v-btn>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      <v-alert v-else-if="status && !status.installed" type="warning" variant="tonal" density="compact">
        The Ookla speedtest program isn't installed on the router.
      </v-alert>

      <template v-if="status && status.installed">
        <div class="hk-st-grid">
          <div class="hk-tile">
            <span class="hk-label">Download</span>
            <span class="hk-display" style="font-size: 36px">{{ mbps(run ? run.download : last?.download) }}</span>
            <span class="hk-label">Mbps</span>
          </div>
          <div class="hk-tile">
            <span class="hk-label">Upload</span>
            <span class="hk-display" style="font-size: 36px">{{ mbps(run ? run.upload : last?.upload) }}</span>
            <span class="hk-label">Mbps</span>
          </div>
          <div class="hk-tile">
            <span class="hk-label">Latency</span>
            <span class="hk-display" style="font-size: 36px">{{ (run ? run.latency : last?.latency)?.toFixed(0) ?? '—' }}</span>
            <span class="hk-label">ms</span>
          </div>
        </div>

        <div v-if="run" class="d-flex flex-column ga-2">
          <div class="d-flex text-body-medium">
            <span class="flex-grow-1 font-weight-bold">{{ STAGE[run.stage] ?? run.stage }}…</span>
            <span class="text-muted">{{ run.server || run.isp }}</span>
          </div>
          <v-progress-linear
            :model-value="run.progress != null ? run.progress * 100 : undefined"
            :indeterminate="run.progress == null"
            color="primary"
            bg-color="secondary-container"
            bg-opacity="1"
            height="8"
            rounded
          />
        </div>
        <p v-else-if="last" class="text-body-medium text-muted">
          <template v-if="last.ok">
            Last test {{ new Date(last.started * 1000).toLocaleString() }} over {{ ifaces.find((i) => i.name === last?.interface)?.label ?? last.interface }} · {{ last.isp }}<template v-if="last.server"> · {{ last.server }}</template>
          </template>
          <template v-else>Last test failed: {{ last.error }}</template>
        </p>

        <v-select
          v-if="!run"
          v-model="iface"
          :items="ifaces.map((i) => ({ title: i.available ? i.label : `${i.label} — ${i.reason}`, value: i.name, props: { disabled: !i.available } }))"
          label="Test over"
          hide-details
        />

        <p v-if="!status.accepted && !run" class="text-body-small text-muted">
          Starting a test accepts Ookla's licence, terms of use and privacy policy (speedtest.net).
        </p>

        <!-- mt-auto: on a phone the dialog is full screen, and the action
             belongs at the bottom, within reach of a thumb -->
        <div class="d-flex justify-end ga-2 mt-auto">
          <v-btn v-if="run" variant="text" @click="cancel">Stop</v-btn>
          <v-btn v-else color="primary" variant="flat" size="large" :loading="starting" :disabled="!iface" @click="start">
            {{ last ? 'Test again' : 'Start test' }}
          </v-btn>
        </div>
      </template>
      <v-skeleton-loader v-else-if="!error" type="heading, text, text" bg-color="transparent" />
    </v-card>
  </v-dialog>
</template>

<style scoped>
.hk-st-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.hk-st-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.hk-st-grid .hk-tile {
  padding: 14px 16px;
  gap: 6px;
}
</style>
