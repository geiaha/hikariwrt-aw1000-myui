<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import M3Progress from '@/components/m3/M3Progress.vue'
import * as modem from '@/api/modem'
import type { KnownCell, LockInfo } from '@/api/modem'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { signed } from '@/utils/format'

// Cell lock: pick cells the modem has seen (serving, carrier aggregation,
// neighbours, and anything a scan found) and pin the modem to them.
// One 5G cell at most; LTE up to the modem's limit. A scan drops data for
// the whole sweep and can't be stopped, so it asks first and is watched
// with a 5 s poll only while it runs.
const props = defineProps<{ lock: LockInfo | null }>()
const emit = defineEmits<{ changed: [state?: LockInfo] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const key = (c: { arfcn: number; pci: number }, tech: string) => `${tech}:${c.arfcn}/${c.pci}`
const picked = ref<Set<string>>(new Set())
const persist = ref(true)

const lteMax = computed(() => props.lock?.cell_lock.lte.max ?? 10)
const current = computed(() => {
  const l = props.lock?.cell_lock
  if (!l) return []
  return [
    ...(l.nr ? [{ key: key(l.nr, 'NR'), text: `5G · n${l.nr.band} · PCI ${l.nr.pci} · ARFCN ${l.nr.arfcn}` }] : []),
    ...l.lte.cells.map((c) => ({ key: key(c, 'LTE'), text: `LTE · PCI ${c.pci} · EARFCN ${c.arfcn}` })),
  ]
})

// Start from the current lock so "Lock" with no edits changes nothing.
watch(
  () => props.lock,
  (l) => {
    picked.value = new Set(current.value.map((c) => c.key))
    if (l?.saved) persist.value = l.saved.persist || !current.value.length
  },
  { immediate: true },
)

const cells = computed(() =>
  [...(props.lock?.cells ?? [])].sort((a, b) => (b.rsrp ?? -200) - (a.rsrp ?? -200)),
)
const SOURCE: Record<KnownCell['source'], string> = { serving: 'Serving', ca: 'Carrier aggregation', neighbour: 'Neighbour', scan: 'From scan' }

function toggle(c: KnownCell): void {
  const k = key(c, c.tech)
  const next = new Set(picked.value)
  if (next.has(k)) next.delete(k)
  else {
    // Only one 5G cell can be locked: picking another replaces it.
    if (c.tech === 'NR') for (const x of [...next]) if (x.startsWith('NR:')) next.delete(x)
    if (c.tech === 'LTE' && [...next].filter((x) => x.startsWith('LTE:')).length >= lteMax.value) return
    next.add(k)
  }
  picked.value = next
}

const dirty = computed(() => [...picked.value].sort().join() !== current.value.map((c) => c.key).sort().join())

async function lockNow(): Promise<void> {
  const chosen = cells.value.filter((c) => picked.value.has(key(c, c.tech)))
  // Cells locked now but no longer listed stay in the lock.
  const lteNow = props.lock?.cell_lock.lte.cells.filter((c) => picked.value.has(key(c, 'LTE'))) ?? []
  const lte = [...new Map([...lteNow, ...chosen.filter((c) => c.tech === 'LTE')].map((c) => [key(c, 'LTE'), { arfcn: c.arfcn, pci: c.pci }])).values()]
  const nrCell = chosen.find((c) => c.tech === 'NR')
  const nrNow = props.lock?.cell_lock.nr
  const nr = nrCell
    ? { arfcn: nrCell.arfcn, pci: nrCell.pci, band: nrCell.band!, scs: nrCell.scs! }
    : nrNow && picked.value.has(key(nrNow, 'NR'))
      ? nrNow
      : null
  const unlocking = !lte.length && !nr
  const ok = await ask({
    title: unlocking ? 'Remove the cell lock?' : 'Lock to these cells?',
    text: unlocking
      ? 'The modem goes back to choosing cells itself. It re-searches, so the cellular link drops for a moment.'
      : 'The modem re-searches and will only use the chosen cells. If none of them is reachable, there is no cellular connection until you unlock.',
    confirm: unlocking ? 'Unlock' : 'Lock',
  })
  if (!ok) return
  let state: LockInfo | undefined
  const done = await run('lock', async () => {
    const r = await modem.setLock(lte, nr, persist.value && !unlocking)
    state = r.state
    return r
  }, unlocking ? 'Cell lock removed' : 'Cell lock applied')
  if (done) emit('changed', state)
}

async function unlockAll(): Promise<void> {
  picked.value = new Set()
  await lockNow()
}

// ---- scan ----
const scan = ref<modem.ScanStatus | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

async function watchScan(): Promise<void> {
  clearTimeout(timer)
  scan.value = await modem.scanStatus().catch(() => scan.value)
  if (scan.value?.running) timer = setTimeout(watchScan, 5000)
  else if (scan.value?.state === 'done' || scan.value?.state === 'failed') emit('changed')
}

async function startScan(): Promise<void> {
  const ok = await ask({
    title: 'Scan for cells?',
    text: 'The modem sweeps LTE and 5G for about a minute and a half. The cellular connection drops for the whole sweep and it can’t be stopped once started.',
    confirm: 'Scan',
  })
  if (!ok) return
  if (await run('scan', () => modem.scanStart(3))) watchScan()
}

async function forgetScan(): Promise<void> {
  let state: LockInfo | undefined
  if (await run('forget', async () => {
    const r = await modem.scanClear()
    state = r.state
    return r
  }, 'Scan results cleared')) emit('changed', state)
}

modem.scanStatus().then((s) => {
  scan.value = s
  if (s.running) watchScan()
}, () => undefined)
onBeforeUnmount(() => clearTimeout(timer))

const scanPct = computed(() => {
  const s = scan.value
  return s?.running && s.elapsed != null ? Math.min(99, (s.elapsed / 90) * 100) : 0
})
const hasScanRows = computed(() => cells.value.some((c) => c.source === 'scan'))
</script>

<template>
  <section class="hk-card" aria-label="Cell lock" style="gap: 14px">
    <div class="d-flex align-center flex-wrap ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <h2 class="hk-h2">Cell lock</h2>
        <span class="text-muted" style="font-size: 13px">Pin the modem to cells you choose. One 5G cell, up to {{ lteMax }} LTE cells.</span>
      </div>
      <v-btn variant="flat" color="secondary-container" height="40" :loading="busy.scan || scan?.running" :disabled="!scan?.supported" @click="startScan">
        Scan for cells
      </v-btn>
    </div>

    <div v-if="scan?.running" class="d-flex flex-column ga-2">
      <div class="d-flex text-body-medium"><span class="flex-grow-1 font-weight-bold">Scanning…</span><span class="text-muted">{{ scan.elapsed ?? 0 }} s</span></div>
      <M3Progress :value="scanPct" label="Scan progress" />
    </div>
    <v-alert v-else-if="scan?.state === 'failed' && scan.error" type="error" variant="tonal" density="compact">{{ scan.error }}</v-alert>

    <div v-if="current.length" class="hk-current">
      <HkIcon name="lock" :size="20" />
      <div class="d-flex flex-column flex-grow-1">
        <span v-for="c in current" :key="c.key" class="font-weight-bold" style="font-size: 14px">{{ c.text }}</span>
        <span class="hk-label">{{ lock?.saved?.persist ? 'Kept after a reboot' : 'Until the next reboot' }}</span>
      </div>
      <v-btn variant="text" color="primary" height="40" :loading="busy.lock" @click="unlockAll">Unlock</v-btn>
    </div>

    <div v-if="lock" class="hk-cells" role="group" aria-label="Known cells">
      <label v-for="c in cells" :key="key(c, c.tech)" class="hk-cell" :class="{ 'is-on': picked.has(key(c, c.tech)), 'is-off': !c.lockable }">
        <input type="checkbox" class="hk-sr-only" :checked="picked.has(key(c, c.tech))" :disabled="!c.lockable" @change="toggle(c)" />
        <span class="hk-cell__box"><HkIcon v-if="picked.has(key(c, c.tech))" name="check" :size="16" :stroke="2.6" /></span>
        <span class="hk-cell__main">
          <span class="font-weight-bold">{{ c.tech === 'NR' ? '5G' : 'LTE' }} · {{ c.band != null ? (c.tech === 'NR' ? `n${c.band}` : `B${c.band}`) : 'band ?' }}</span>
          <span class="hk-label">PCI {{ c.pci }} · {{ c.tech === 'NR' ? 'ARFCN' : 'EARFCN' }} {{ c.arfcn }}<template v-if="c.bandwidth"> · {{ c.bandwidth }} MHz</template> · {{ SOURCE[c.source] }}</span>
        </span>
        <span class="hk-cell__sig hk-num">{{ signed(c.rsrp) }} dBm</span>
      </label>
      <p v-if="!cells.length" class="text-muted">No cells seen yet. A scan lists what's around.</p>
    </div>
    <v-skeleton-loader v-else type="list-item-two-line@2" bg-color="transparent" />

    <div class="d-flex align-center flex-wrap ga-3">
      <M3Switch v-model="persist" label="Keep the lock after a reboot" />
      <span class="flex-grow-1" style="font-size: 14px">Keep after a reboot</span>
      <v-btn v-if="hasScanRows" variant="text" color="primary" height="40" :loading="busy.forget" @click="forgetScan">Forget scan</v-btn>
      <v-btn variant="flat" color="primary" height="40" :disabled="!dirty" :loading="busy.lock" @click="lockNow">{{ picked.size ? 'Lock' : 'Unlock' }}</v-btn>
    </div>
  </section>
</template>

<style scoped>
.hk-current {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px 12px 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
}
.hk-current .hk-label {
  color: inherit;
  opacity: 0.8;
}
.hk-cells {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hk-cell {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 56px;
  padding: 8px 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
  border-radius: 4px;
  cursor: pointer;
}
.hk-cell:first-child {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.hk-cell:last-of-type {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
.hk-cell.is-off {
  cursor: default;
  opacity: 0.55;
}
.hk-cell:focus-within {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: -3px;
}
.hk-cell__box {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 2px solid rgb(var(--v-theme-outline));
  display: grid;
  place-items: center;
}
.is-on .hk-cell__box {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hk-cell__main {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
  font-size: 14px;
}
.hk-cell__sig {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
