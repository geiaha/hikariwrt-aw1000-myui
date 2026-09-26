<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Progress from '@/components/m3/M3Progress.vue'
import * as storage from '@/api/storage'
import type { Disk, Partition } from '@/api/storage'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { bytes, percent } from '@/utils/format'

// One USB drive and its partitions. Everything touching the drive that holds
// the running router storage is disabled here and refused by the backend.
const props = defineProps<{ disk: Disk; jobRunning: boolean }>()
const emit = defineEmits<{ changed: []; format: [disk: Disk] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const holdsRoot = computed(() => props.disk.partitions.some((p) => p.mode === 'rootfs-active'))
const usb = computed(() => {
  const v = props.disk.usb_version
  const s = props.disk.speed_mbps
  const name = s >= 10000 ? 'USB 3.1' : s >= 5000 ? 'USB 3.0' : v ? `USB ${v.replace(/\.0+$/, '')}` : 'USB'
  return s ? `${name} · ${s >= 1000 ? `${s / 1000} Gbps` : `${s} Mbps`}` : name
})

const MODE: Record<string, { text: string; cls: string }> = {
  data: { text: 'Data drive', cls: 'hk-chip--tonal' },
  'rootfs-active': { text: 'Router storage', cls: 'hk-chip--filled' },
  'rootfs-pending': { text: 'Router storage after reboot', cls: 'hk-chip--outline' },
}

function usage(p: Partition) {
  if (!p.mounted || !p.total_kb) return null
  const used = (p.used_kb ?? 0) * 1024
  const total = p.total_kb * 1024
  return { used, total, pct: percent(used, total) }
}

async function act(p: Partition, what: 'mount' | 'umount' | 'forget'): Promise<void> {
  if (what === 'forget') {
    const ok = await ask({ title: `Forget ${p.label || p.name}?`, text: 'The router stops remembering this partition (its mount settings). Nothing on the drive is touched.', confirm: 'Forget' })
    if (!ok) return
  }
  const done = await run(`${what}:${p.name}`, () => storage[what](p.name), what === 'mount' ? `Mounted at /mnt/${p.label || p.name}` : what === 'umount' ? 'Unmounted' : 'Forgotten')
  if (done) emit('changed')
}

async function useAsRoot(p: Partition): Promise<void> {
  const ok = await ask({
    title: 'Use this drive as router storage?',
    text:
      'The router’s own settings and installed packages are copied onto this partition, and from the next reboot the router keeps them there instead of in its internal flash, which gives far more room.\n\n' +
      'Keep the drive plugged in. If it’s missing at boot, the router falls back to its internal storage. You can switch back here at any time.',
    confirm: 'Copy and prepare',
  })
  if (ok && (await run(`root:${p.name}`, () => storage.extroot(p.name, 'enable'), 'Copying the router’s storage…'))) emit('changed')
}

async function stopRoot(p: Partition): Promise<void> {
  const ok = await ask({
    title: p.mode === 'rootfs-pending' ? 'Cancel the switch?' : 'Go back to internal storage?',
    text: p.mode === 'rootfs-pending' ? 'The router keeps using its internal storage after the next reboot.' : 'From the next reboot the router uses its internal flash again. Changes made while on USB stay on the drive and are not copied back.',
    confirm: p.mode === 'rootfs-pending' ? 'Cancel switch' : 'Switch back',
  })
  if (ok && (await run(`root:${p.name}`, () => storage.extroot(p.name, 'disable'), 'Done. Reboot to finish.'))) emit('changed')
}

async function eject(): Promise<void> {
  const ok = await ask({ title: `Eject ${props.disk.vendor} ${props.disk.model}?`, text: 'Everything on it is unmounted and the drive is detached. Unplug it once it disappears from this page.', confirm: 'Eject' })
  if (ok && (await run('eject', () => storage.eject(props.disk.name), 'Safe to unplug'))) emit('changed')
}
</script>

<template>
  <section class="hk-card" :aria-label="`Drive ${disk.name}`" style="gap: 14px">
    <div class="d-flex align-center flex-wrap ga-3">
      <span class="hk-disk-icon"><HkIcon name="storage" /></span>
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 class="hk-h2">{{ [disk.vendor, disk.model].filter(Boolean).join(' ') || disk.name }}</h2>
        <span class="text-muted" style="font-size: 13px">{{ bytes(disk.size) }} · {{ usb }} · {{ disk.name }}<template v-if="disk.readonly"> · read-only</template></span>
      </div>
      <v-btn variant="text" color="error" height="40" :disabled="holdsRoot || jobRunning" @click="emit('format', disk)">Format…</v-btn>
      <v-btn variant="flat" color="secondary-container" height="40" :disabled="holdsRoot || jobRunning" :loading="busy.eject" :title="holdsRoot ? 'The router is running from this drive' : undefined" @click="eject">
        Eject
      </v-btn>
    </div>

    <div v-for="p in disk.partitions" :key="p.name" class="hk-part">
      <div class="d-flex align-center flex-wrap ga-2">
        <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
          <span class="font-weight-bold" style="font-size: 15px">{{ p.label || p.name }}</span>
          <span class="hk-label">
            {{ (p.fs || 'unknown').toUpperCase() }} · {{ bytes(p.size) }}<template v-if="p.mounted && p.mountpoint"> · {{ p.mountpoint }}</template>
            <template v-else> · not mounted</template>
          </span>
        </div>
        <span v-if="MODE[p.mode]" class="hk-chip" :class="MODE[p.mode]!.cls">{{ MODE[p.mode]!.text }}</span>
        <v-menu location="bottom end">
          <template #activator="{ props: m }">
            <v-btn v-bind="m" icon variant="text" size="small" :aria-label="`Actions for ${p.label || p.name}`" :disabled="jobRunning || !!busy[`root:${p.name}`]">
              <HkIcon name="moreVert" />
            </v-btn>
          </template>
          <v-list bg-color="surface-container" rounded="lg" min-width="240">
            <template v-if="p.mode !== 'rootfs-active'">
              <v-list-item v-if="!p.mounted" title="Mount" :disabled="!p.supported" @click="act(p, 'mount')" />
              <v-list-item v-else title="Unmount" @click="act(p, 'umount')" />
              <v-list-item v-if="p.mode !== 'rootfs-pending' && (p.fs === 'ext4' || p.fs === 'f2fs')" title="Use as router storage" subtitle="Move settings & packages here" @click="useAsRoot(p)" />
              <v-list-item v-if="p.fstab" title="Forget" @click="act(p, 'forget')" />
            </template>
            <v-list-item v-if="p.mode === 'rootfs-active' || p.mode === 'rootfs-pending'" :title="p.mode === 'rootfs-pending' ? 'Cancel the switch' : 'Back to internal storage'" @click="stopRoot(p)" />
          </v-list>
        </v-menu>
      </div>
      <template v-if="usage(p)">
        <M3Progress :value="usage(p)!.pct" :tone="usage(p)!.pct >= 90 ? 'error' : 'primary'" :label="`${p.label || p.name} used`" />
        <span class="hk-label">{{ bytes(usage(p)!.used) }} used · {{ bytes(usage(p)!.total - usage(p)!.used) }} free</span>
      </template>
    </div>
    <p v-if="!disk.partitions.length" class="text-muted" style="font-size: 14px; margin: 0">No partitions. Format the drive to use it.</p>
  </section>
</template>

<style scoped>
.hk-disk-icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-part {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 12px 14px 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
</style>
