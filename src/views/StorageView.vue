<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Progress from '@/components/m3/M3Progress.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import DiskCard from '@/components/storage/DiskCard.vue'
import FormatDialog from '@/components/storage/FormatDialog.vue'
import * as storage from '@/api/storage'
import type { Disk } from '@/api/storage'
import { usePoll } from '@/composables/poll'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { bytes, percent } from '@/utils/format'

// Storage: polled every 5 s so plugging a drive in or out shows up on its
// own (the backend's status is built from sysfs, block info and df).
const st = usePoll(() => storage.status(), 5000)
const { busy, run } = useAction()
const { ask } = useConfirm()
const formatting = ref(false)
const formatDisk = ref<Disk | null>(null)

const s = computed(() => st.data.value)
const job = computed(() => s.value?.job ?? null)
const running = computed(() => job.value?.state === 'running')
const pending = computed(() => s.value?.disks.flatMap((d) => d.partitions).find((p) => p.mode === 'rootfs-pending') ?? null)

// Notice drives arriving and leaving between polls.
const names = computed(() => (s.value?.disks ?? []).map((d) => d.name).join())
const prev = ref<string | null>(null)
const arrived = ref('')
watch(names, (n) => {
  if (prev.value !== null && n.length > prev.value.length) arrived.value = 'A drive was plugged in'
  else if (prev.value !== null && n.length < prev.value.length) arrived.value = 'A drive was removed'
  prev.value = n
})

const internal = computed(() => {
  const i = s.value?.internal
  if (!i) return null
  return { used: i.used_kb * 1024, total: i.total_kb * 1024, pct: percent(i.used_kb, i.total_kb), usb: i.location === 'usb' }
})
const tmp = computed(() => {
  const t = s.value?.tmp
  return t ? { used: t.used_kb * 1024, total: t.total_kb * 1024, pct: percent(t.used_kb, t.total_kb) } : null
})

async function setSetting(which: 'automount' | 'check_fs', v: boolean): Promise<void> {
  const cur = s.value?.settings
  if (!cur) return
  if (await run(which, () => storage.settings(which === 'automount' ? v : cur.automount, which === 'check_fs' ? v : cur.check_fs), 'Saved')) st.refresh()
}

async function reboot(): Promise<void> {
  const ok = await ask({ title: 'Reboot now?', text: 'The router restarts, which takes about two minutes. Everyone is offline meanwhile.', confirm: 'Reboot', destructive: true })
  if (ok) await run('reboot', () => storage.reboot(), 'Rebooting… this page reconnects when the router is back')
}

const KIND: Record<string, string> = { format: 'Formatting', extroot: 'Copying router storage' }
</script>

<template>
  <PageHeader overline="USB drives and router storage" title="Storage" />

  <v-alert v-if="st.error.value" type="error" variant="tonal" rounded="xl">
    {{ st.error.value instanceof Error ? st.error.value.message : st.error.value }}
  </v-alert>

  <!-- A running or just-finished job -->
  <section v-if="job && (running || job.state === 'failed')" class="hk-card hk-job" :class="{ failed: job.state === 'failed' }" aria-live="polite">
    <div class="d-flex align-center ga-3">
      <v-progress-circular v-if="running" indeterminate size="24" width="3" color="primary" />
      <HkIcon v-else name="close" />
      <div class="d-flex flex-column flex-grow-1">
        <span class="font-weight-bold">{{ KIND[job.kind] ?? job.kind }} {{ job.target }}<template v-if="job.state === 'failed'"> failed</template></span>
        <span class="hk-label">{{ job.error || job.message || job.step }}</span>
      </div>
    </div>
  </section>

  <v-alert v-if="pending" type="info" variant="tonal" rounded="xl">
    <div class="d-flex align-center flex-wrap ga-3">
      <span class="flex-grow-1">{{ pending.label || pending.name }} is ready to be the router’s storage. Reboot to switch over.</span>
      <v-btn variant="flat" color="primary" height="40" :loading="busy.reboot" @click="reboot">Reboot now</v-btn>
    </div>
  </v-alert>

  <div class="hk-grid-3">
    <section class="hk-card" aria-label="Router storage" style="gap: 12px">
      <div class="d-flex align-center ga-2">
        <h2 class="hk-h2 flex-grow-1">Router storage</h2>
        <span v-if="internal" class="hk-chip" :class="internal.usb ? 'hk-chip--filled' : 'hk-chip--outline'">{{ internal.usb ? 'On USB' : 'Internal flash' }}</span>
      </div>
      <template v-if="internal">
        <span class="hk-display" style="font-size: 28px">{{ bytes(internal.total - internal.used) }} <span class="text-muted" style="font-size: 14px">free</span></span>
        <M3Progress :value="internal.pct" :tone="internal.pct >= 90 ? 'error' : 'primary'" label="Router storage used" />
        <span class="hk-label">{{ bytes(internal.used) }} of {{ bytes(internal.total) }} used · settings and installed packages</span>
      </template>
      <v-skeleton-loader v-else type="text@3" bg-color="transparent" />
    </section>

    <section class="hk-card" aria-label="Temporary storage" style="gap: 12px">
      <h2 class="hk-h2">Temporary (RAM)</h2>
      <template v-if="tmp">
        <span class="hk-display" style="font-size: 28px">{{ bytes(tmp.total - tmp.used) }} <span class="text-muted" style="font-size: 14px">free</span></span>
        <M3Progress :value="tmp.pct" label="Temporary storage used" />
        <span class="hk-label">Logs and caches; cleared on every reboot</span>
      </template>
    </section>

    <section class="hk-card" aria-label="Storage settings" style="gap: 12px">
      <h2 class="hk-h2">When a drive is plugged in</h2>
      <template v-if="s">
        <div class="d-flex align-center ga-3">
          <div class="d-flex flex-column flex-grow-1">
            <span style="font-size: 14px">Mount it automatically</span>
            <span class="hk-label">As a data drive under {{ s.settings.mount_root }}</span>
          </div>
          <M3Switch :model-value="s.settings.automount" label="Mount new drives automatically" :busy="busy.automount" @update:model-value="setSetting('automount', $event)" />
        </div>
        <div class="d-flex align-center ga-3">
          <div class="d-flex flex-column flex-grow-1">
            <span style="font-size: 14px">Check it first</span>
            <span class="hk-label">Repairs errors before mounting; slower to appear</span>
          </div>
          <M3Switch :model-value="s.settings.check_fs" label="Check filesystems before mounting" :busy="busy.check_fs" @update:model-value="setSetting('check_fs', $event)" />
        </div>
      </template>
    </section>
  </div>

  <template v-if="s">
    <DiskCard v-for="d in s.disks" :key="d.name" :disk="d" :job-running="running" @changed="st.refresh()" @format="(disk) => ((formatDisk = disk), (formatting = true))" />
    <section v-if="!s.disks.length" class="hk-card hk-empty">
      <span class="hk-empty__icon"><HkIcon name="storage" :size="32" /></span>
      <h2 class="hk-h2" style="font-size: 22px">No USB drive plugged in</h2>
      <p class="text-muted">Plug a drive into the router’s USB port; it shows up here within a few seconds.</p>
    </section>
  </template>

  <FormatDialog v-model="formatting" :disk="formatDisk" @started="st.refresh()" />
  <v-snackbar :model-value="!!arrived" :timeout="3000" location="bottom" @update:model-value="(v: boolean) => !v && (arrived = '')">{{ arrived }}</v-snackbar>
</template>

<style scoped>
.hk-job.failed {
  background: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
}
.hk-job.failed .hk-label {
  color: inherit;
}
.hk-empty {
  align-items: center;
  text-align: center;
  padding: 40px 24px;
  gap: 10px;
}
.hk-empty p {
  margin: 0;
}
.hk-empty__icon {
  width: 72px;
  height: 72px;
  border-radius: 36px;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
</style>
