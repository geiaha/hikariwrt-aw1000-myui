<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import AppearanceSettings from '@/components/AppearanceSettings.vue'
import SecretField from '@/components/m3/SecretField.vue'
import FirmwareCard from '@/components/system/FirmwareCard.vue'
import LogCard from '@/components/system/LogCard.vue'
import * as sys from '@/api/system'
import { systemInfo } from '@/api/router'
import { usePoll } from '@/composables/poll'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'
import { duration } from '@/utils/format'

// System: the router itself. Settings load once; the clock and uptime tick
// with a 10 s poll of system info.
const session = useSession()
const ui = useUi()
const { busy, run } = useAction()
const { ask } = useConfirm()

const APP_VERSION = __APP_VERSION__
const info = usePoll(() => systemInfo(), 10000)
const settings = ref<sys.SystemSettings | null>(null)
const zones = ref<Record<string, { tzstring: string }>>({})
const form = reactive({ hostname: '', zonename: '' })

onMounted(async () => {
  const [s, z] = await Promise.all([sys.systemSettings().catch(() => null), sys.timezones().catch(() => ({}))])
  settings.value = s
  zones.value = z
  if (s) Object.assign(form, { hostname: s.hostname, zonename: s.zonename })
})

const zoneItems = computed(() => Object.keys(zones.value).sort())
const hostOk = computed(() => /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(form.hostname))
const dirty = computed(() => !!settings.value && (form.hostname !== settings.value.hostname || form.zonename !== settings.value.zonename))
const routerTime = computed(() => {
  const t = info.data.value?.localtime
  // localtime is the router's wall clock expressed as if it were UTC.
  return t ? new Date(t * 1000).toLocaleString(undefined, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) : '—'
})

async function saveSettings(): Promise<void> {
  const s = settings.value!
  const tz = zones.value[form.zonename]?.tzstring ?? 'UTC0'
  if (await run('settings', () => sys.saveSystem(s.section, form.hostname, form.zonename, tz), 'Saved')) {
    settings.value = { ...s, hostname: form.hostname, zonename: form.zonename }
  }
}
const syncClock = () => run('clock', () => sys.setLocaltime(Math.floor(Date.now() / 1000)), 'Router clock set from this device').then(() => info.refresh())

// ---- password ----
const pw = reactive({ a: '', b: '' })
const pwError = computed(() => {
  if (!pw.a) return null
  if (pw.a.length < 8) return 'At least 8 characters'
  if (pw.b && pw.a !== pw.b) return 'The two don’t match'
  return null
})
async function savePassword(): Promise<void> {
  if (await run('pw', () => sys.setPassword(pw.a), 'Password changed. Use it next time you sign in.')) Object.assign(pw, { a: '', b: '' })
}

// ---- backup / power ----
async function restore(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  const ok = await ask({
    title: 'Restore this backup?',
    text: `The settings in ${f.name} replace the current ones, and the router restarts. Its address may change to the one in the backup.`,
    confirm: 'Restore',
    destructive: true,
  })
  if (ok && (await run('restore', () => sys.restoreBackup(f)))) ui.offline = { title: 'Restoring settings', text: 'The router restarts with the restored settings, usually in about two minutes.' }
}

async function reboot(): Promise<void> {
  const ok = await ask({ title: 'Restart the router?', text: 'Everyone is offline for about two minutes.', confirm: 'Restart' })
  if (ok && (await run('reboot', () => sys.reboot()))) ui.offline = { title: 'Restarting', text: 'The router is restarting. This page reconnects when it’s back, usually in about two minutes.' }
}

async function reset(): Promise<void> {
  const ok = await ask({
    title: 'Erase all settings?',
    text:
      'Every setting is erased: Wi-Fi names and passwords, PPPoE login, mesh, VPN tunnels, reservations. The router restarts as new, at 192.168.1.1 with no password.\n\nDownload a backup first if you might want them back.',
    confirm: 'Erase and restart',
    destructive: true,
  })
  if (ok && (await run('reset', () => sys.factoryReset())))
    ui.offline = { title: 'Resetting', text: 'The router is erasing its settings and restarting.', expectAddress: '192.168.1.1' }
}
</script>

<template>
  <PageHeader :overline="`${session.board?.model ?? 'Router'} · ${session.board?.release.distribution ?? ''} ${session.board?.release.version ?? ''}`" title="System" />

  <div class="hk-grid-3" style="align-items: start">
    <section class="hk-card" aria-label="Name and time" style="gap: 14px">
      <h2 class="hk-h2">Name and time</h2>
      <template v-if="settings">
        <v-text-field v-model="form.hostname" label="Router name" hint="How it appears on the network" persistent-hint :error-messages="hostOk ? undefined : 'Letters, digits and dashes'" />
        <v-autocomplete v-model="form.zonename" :items="zoneItems" label="Time zone" hide-details />
        <div class="d-flex align-center ga-3">
          <div class="d-flex flex-column flex-grow-1">
            <span style="font-size: 14px">{{ routerTime }}</span>
            <span class="hk-label">{{ settings.ntp ? 'Kept right by internet time servers' : 'Set by hand' }}</span>
          </div>
          <v-btn variant="text" color="primary" height="40" :loading="busy.clock" @click="syncClock">Use this device’s time</v-btn>
        </div>
        <div class="d-flex justify-end">
          <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !hostOk" :loading="busy.settings" @click="saveSettings">Save</v-btn>
        </div>
      </template>
      <v-skeleton-loader v-else type="text@3" bg-color="transparent" />
    </section>

    <section class="hk-card" aria-label="Admin password" style="gap: 14px">
      <h2 class="hk-h2">Admin password</h2>
      <span class="text-muted" style="font-size: 14px">Used to sign in here, in LuCI and over SSH as root.</span>
      <SecretField v-model="pw.a" label="New password" :error-messages="pwError" />
      <SecretField v-model="pw.b" label="Type it again" />
      <div class="d-flex justify-end">
        <v-btn variant="flat" color="primary" height="40" :disabled="!pw.a || pw.a !== pw.b || !!pwError" :loading="busy.pw" @click="savePassword">Change password</v-btn>
      </div>
    </section>

    <section class="hk-card" aria-label="About" style="gap: 12px">
      <h2 class="hk-h2">About this router</h2>
      <dl class="hk-group hk-kv">
        <div><dt>Model</dt><dd>{{ session.board?.model }}</dd></div>
        <div><dt>Firmware</dt><dd>{{ session.board?.release.description }}</dd></div>
        <div><dt>Kernel</dt><dd>{{ session.board?.kernel }}</dd></div>
        <div><dt>Up for</dt><dd>{{ duration(info.data.value?.uptime) }}</dd></div>
        <div><dt>This UI</dt><dd>hikari-ui {{ APP_VERSION }}</dd></div>
      </dl>
    </section>

    <FirmwareCard />

    <section class="hk-card" aria-label="Backup" style="gap: 14px">
      <h2 class="hk-h2">Backup and restore</h2>
      <span class="text-muted" style="font-size: 14px">A backup holds every setting (not installed packages). Keep one before big changes or a firmware upgrade.</span>
      <div class="d-flex flex-wrap ga-2">
        <v-btn variant="flat" color="primary" height="40" @click="sys.downloadBackup()">Download backup</v-btn>
        <label class="hk-file" :class="{ busy: busy.restore }">
          Restore from file…
          <input type="file" accept=".tar.gz,.tgz,application/gzip" class="hk-sr-only" :disabled="busy.restore" @change="restore" />
        </label>
      </div>
    </section>

    <section class="hk-card" aria-label="Restart and reset" style="gap: 14px">
      <h2 class="hk-h2">Restart and reset</h2>
      <div class="d-flex align-center ga-3">
        <div class="d-flex flex-column flex-grow-1">
          <span style="font-size: 14px">Restart</span>
          <span class="hk-label">About two minutes offline</span>
        </div>
        <v-btn variant="flat" color="secondary-container" height="40" :loading="busy.reboot" @click="reboot">Restart</v-btn>
      </div>
      <div class="d-flex align-center ga-3">
        <div class="d-flex flex-column flex-grow-1">
          <span style="font-size: 14px">Factory reset</span>
          <span class="hk-label">Erases every setting</span>
        </div>
        <v-btn variant="text" color="error" height="40" :loading="busy.reset" @click="reset">Reset…</v-btn>
      </div>
    </section>

    <section class="hk-card" aria-label="Setup wizard" style="gap: 14px">
      <h2 class="hk-h2">Setup wizard</h2>
      <span class="text-muted" style="font-size: 14px">Walk through the basics again: password, name and time, internet and Wi-Fi. Every step shows what you have now and can be skipped.</span>
      <v-btn to="/setup" variant="flat" color="secondary-container" height="40" style="align-self: flex-start">Run setup again</v-btn>
    </section>

    <section class="hk-card" aria-label="Appearance" style="gap: 14px">
      <h2 class="hk-h2">Appearance</h2>
      <span class="text-muted" style="font-size: 14px">Saved in this browser only.</span>
      <AppearanceSettings />
    </section>
  </div>

  <LogCard />
</template>

<style scoped>
.hk-kv {
  margin: 0;
  font-size: 14px;
}
.hk-kv > div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 6px 14px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-kv dt {
  flex-grow: 1;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-kv dd {
  margin: 0;
  font-size: 13px;
  text-align: right;
  overflow-wrap: anywhere;
}
.hk-file {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 20px;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.hk-file.busy {
  opacity: 0.6;
  cursor: progress;
}
.hk-file:focus-within {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
</style>
