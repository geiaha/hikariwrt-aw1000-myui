<script setup lang="ts">
import { computed } from 'vue'
import M3Progress from '@/components/m3/M3Progress.vue'
import type { Board, SystemInfo } from '@/api/router'
import type { StorageStatus } from '@/api/services'
import { bytes, percent } from '@/utils/format'
import { luciUrl } from '@/nav'

const props = defineProps<{ board: Board | null; info: SystemInfo | null; cpu: number | null; storage: StorageStatus | null }>()

const mem = computed(() => {
  const m = props.info?.memory
  if (!m) return null
  const used = m.total - m.available
  return { text: `${Math.round(used / 1e6)} / ${Math.round(m.total / 1e6)} MB`, pct: percent(used, m.total) }
})

// A mounted USB data drive if there is one; otherwise router storage (which
// is on USB too when extroot is active).
const drive = computed(() => {
  const s = props.storage
  if (s) {
    const parts = s.disks.flatMap((d) => d.partitions)
    const data = parts.find((p) => p.mounted && p.mode === 'data' && p.total_kb)
    if (data) {
      const used = (data.used_kb ?? 0) * 1024
      const total = (data.total_kb ?? 0) * 1024
      return { label: `USB · ${data.label || data.name}`, used, total, pct: percent(used, total) }
    }
    const used = s.internal.used_kb * 1024
    const total = s.internal.total_kb * 1024
    return { label: s.internal.location === 'usb' ? 'Router storage · USB' : 'Router storage', used, total, pct: percent(used, total) }
  }
  const r = props.info?.root
  if (!r) return null
  return { label: 'Router storage', used: r.used * 1024, total: r.total * 1024, pct: percent(r.used, r.total) }
})
</script>

<template>
  <section class="hk-card" aria-label="System">
    <h2 class="hk-h2">System</h2>
    <template v-if="info">
      <div class="hk-meter">
        <div class="hk-meter__head"><span>CPU</span><span class="hk-num">{{ cpu == null ? '—' : `${cpu}%` }}</span></div>
        <M3Progress :value="cpu ?? 0" label="CPU" />
      </div>
      <div v-if="mem" class="hk-meter">
        <div class="hk-meter__head"><span>Memory</span><span class="hk-num">{{ mem.text }}</span></div>
        <M3Progress :value="mem.pct" label="Memory" />
      </div>
      <div v-if="drive" class="hk-meter">
        <div class="hk-meter__head">
          <span>{{ drive.label }}</span>
          <span class="hk-num" :class="{ 'text-error': drive.pct >= 90 }">{{ bytes(drive.used) }} / {{ bytes(drive.total) }}</span>
        </div>
        <M3Progress :value="drive.pct" :tone="drive.pct >= 90 ? 'error' : 'primary'" label="Storage" />
      </div>
    </template>
    <v-skeleton-loader v-else type="text, text, text" bg-color="transparent" />
    <div class="hk-fw mt-auto">
      <span class="flex-grow-1 text-muted" style="font-size: 13px">Firmware {{ board?.release.distribution }} {{ board?.release.version }}</span>
      <v-btn :href="luciUrl('admin/system/flash')" variant="text" color="primary" height="36" size="small">Upgrade</v-btn>
    </div>
  </section>
</template>

<style scoped>
.hk-meter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hk-meter__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.hk-meter__head > :first-child {
  flex-grow: 1;
  font-weight: 500;
}
.hk-meter__head > :last-child {
  font-size: 13px;
}
.hk-fw {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 14px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
</style>
