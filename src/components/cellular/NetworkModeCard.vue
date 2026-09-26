<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import { setMode, type LockInfo } from '@/api/modem'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'

// Which networks the modem may use (mode_pref) and which kind of 5G
// (nr5g_disable_mode). Apply cycles the radio so it takes effect now.
const props = defineProps<{ lock: LockInfo | null }>()
const emit = defineEmits<{ applied: [state: LockInfo | undefined] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const KNOWN = [
  { value: 'AUTO', title: 'Automatic' },
  { value: 'LTE:NR5G', title: '5G and LTE' },
  { value: 'NR5G', title: '5G only' },
  { value: 'LTE', title: 'LTE only' },
]
const mode = ref('AUTO')
const nr5g = ref<'0' | '1' | '2'>('0')
watch(
  () => props.lock?.mode,
  (m) => {
    if (!m) return
    mode.value = m.pref || 'AUTO'
    nr5g.value = String(m.nr5g_disable ?? 0) as '0' | '1' | '2'
  },
  { immediate: true },
)
const options = computed(() => (KNOWN.some((k) => k.value === mode.value) ? KNOWN : [...KNOWN, { value: mode.value, title: mode.value }]))
const dirty = computed(() => !!props.lock && (mode.value !== props.lock.mode.pref || Number(nr5g.value) !== props.lock.mode.nr5g_disable))

async function apply(): Promise<void> {
  const ok = await ask({
    title: 'Change network mode?',
    text: 'The modem restarts its radio to switch, so the cellular link drops for a few seconds.',
    confirm: 'Apply',
  })
  if (!ok) return
  let state: LockInfo | undefined
  const done = await run(
    'apply',
    async () => {
      const r = await setMode(mode.value, Number(nr5g.value) as 0 | 1 | 2, true)
      state = r.state
      return r
    },
    'Network mode applied',
  )
  if (done) emit('applied', state)
}
</script>

<template>
  <section class="hk-card" aria-label="Network mode" style="gap: 14px">
    <div class="d-flex align-center flex-wrap ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <h2 class="hk-h2">Network mode</h2>
        <span class="text-muted" style="font-size: 13px">Which networks the modem may register on</span>
      </div>
      <v-btn variant="flat" color="primary" height="40" :disabled="!dirty" :loading="busy.apply" @click="apply">Apply</v-btn>
    </div>
    <template v-if="lock">
      <v-select v-model="mode" :items="options" label="Networks" hide-details density="comfortable" />
      <div>
        <div class="hk-label mb-2">Kind of 5G</div>
        <SegmentedButton
          v-model="nr5g"
          label="Kind of 5G"
          :disabled="mode === 'LTE'"
          :options="[
            { value: '0', label: 'SA and NSA' },
            { value: '2', label: 'SA only' },
            { value: '1', label: 'NSA only' },
          ]"
        />
      </div>
    </template>
    <v-skeleton-loader v-else type="text@2" bg-color="transparent" />
  </section>
</template>
