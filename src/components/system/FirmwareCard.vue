<script setup lang="ts">
import { ref } from 'vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import * as sys from '@/api/system'
import type { FirmwareCheck } from '@/api/system'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'
import { bytes } from '@/utils/format'

// Firmware upgrade: upload -> sysupgrade's own image check -> flash. The
// check result decides what's allowed: an image that isn't for this board
// can't be flashed from here at all.
const session = useSession()
const ui = useUi()
const { busy, run } = useAction()
const { ask } = useConfirm()

const file = ref<File | null>(null)
const check = ref<FirmwareCheck | null>(null)
const keep = ref(true)

async function pick(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  file.value = f
  check.value = null
  await run('upload', async () => {
    check.value = await sys.uploadFirmware(f)
    keep.value = check.value.allow_backup
  })
}

async function cancel(): Promise<void> {
  file.value = null
  check.value = null
  await sys.discardFirmware()
}

async function flash(): Promise<void> {
  const ok = await ask({
    title: 'Install this firmware?',
    text:
      `${file.value?.name} will be written to the router, which then restarts. This takes about five minutes and the internet is off meanwhile.\n\n` +
      'Don’t unplug the router while it runs.' +
      (keep.value ? '' : '\n\nSettings are NOT kept: the router comes back with defaults (192.168.1.1).'),
    confirm: 'Install',
    destructive: !keep.value,
  })
  if (!ok) return
  if (await run('flash', () => sys.startUpgrade(keep.value))) {
    ui.offline = {
      title: 'Installing firmware',
      text: 'Don’t unplug the router. It restarts by itself when done, usually within five minutes.',
      expectAddress: keep.value ? undefined : '192.168.1.1',
    }
  }
}
</script>

<template>
  <section class="hk-card" aria-label="Firmware" style="gap: 14px">
    <h2 class="hk-h2">Firmware</h2>
    <span class="text-muted" style="font-size: 14px">
      Running {{ session.board?.release.distribution }} {{ session.board?.release.version }} ({{ session.board?.release.revision }})
    </span>

    <template v-if="!file">
      <label class="hk-file">
        Choose a firmware file…
        <input type="file" accept=".bin,.itb,.img" class="hk-sr-only" @change="pick" />
      </label>
      <span class="hk-label">A sysupgrade image for the Arcadyan AW1000 (HikariWrt or OpenWrt).</span>
    </template>

    <template v-else>
      <div class="hk-tile" style="padding: 12px 16px">
        <span class="font-weight-bold" style="font-size: 14px; overflow-wrap: anywhere">{{ file.name }}</span>
        <span class="hk-label">{{ bytes(file.size) }}</span>
      </div>
      <div v-if="busy.upload" class="d-flex align-center ga-3">
        <v-progress-circular indeterminate size="20" width="2" color="primary" />
        <span style="font-size: 14px">Uploading and checking…</span>
      </div>
      <template v-else-if="check">
        <v-alert v-if="check.valid" type="success" variant="tonal" density="compact">This image is for this router.</v-alert>
        <v-alert v-else type="error" variant="tonal" density="compact">
          This image isn’t for this router (the board check failed), so it can’t be installed from here.
        </v-alert>
        <div v-if="check.valid" class="d-flex align-center ga-3">
          <div class="d-flex flex-column flex-grow-1">
            <span style="font-size: 14px">Keep settings</span>
            <span class="hk-label">{{ check.allow_backup ? 'Recommended' : 'This image can’t keep settings' }}</span>
          </div>
          <M3Switch v-model="keep" label="Keep settings" :disabled="!check.allow_backup" />
        </div>
      </template>
      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" color="primary" height="40" :disabled="busy.upload || busy.flash" @click="cancel">Cancel</v-btn>
        <v-btn variant="flat" color="primary" height="40" :disabled="!check?.valid" :loading="busy.flash" @click="flash">Install</v-btn>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hk-file {
  align-self: flex-start;
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
.hk-file:focus-within {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
</style>
