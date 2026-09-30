<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { setBands, type LockInfo } from '@/api/modem'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'

// Band lock as filter chips: selected = bands the modem may use.
//   group 'nr'   5G: the same list goes to SA and NSA (what LuCI's two 5G
//                groups usually hold), LTE and 3G stay as they are ('-')
//   group 'lte'  LTE only
// Re-registers so the change takes effect now.
// `embedded`: inside another card (Home's quick band lock), so no card
// chrome and no title of its own.
const props = withDefaults(defineProps<{ lock: LockInfo | null; group?: 'nr' | 'lte'; embedded?: boolean }>(), { group: 'nr', embedded: false })
const P = computed(() => (props.group === 'lte' ? 'B' : 'n'))
const NAME = computed(() => (props.group === 'lte' ? 'LTE' : '5G'))
const emit = defineEmits<{ applied: [] }>()
const { busy, run } = useAction()
const { ask } = useConfirm()

const supported = computed(() => {
  const b = props.lock?.bands
  if (!b) return []
  if (props.group === 'lte') return [...b.lte.supported]
  return [...new Set([...b.sa.supported, ...b.nsa.supported])].sort((a, c) => a - c)
})
const configured = computed(() => (props.group === 'lte' ? props.lock?.bands.lte.configured : props.lock?.bands.sa.configured) ?? [])
const picked = ref<number[]>([])
watch(configured, (c) => (picked.value = [...c]), { immediate: true })

const allOn = computed(() => supported.value.length > 0 && supported.value.every((b) => picked.value.includes(b)))
const dirty = computed(() => [...picked.value].sort().join() !== [...configured.value].sort().join())
const summary = computed(() => {
  if (!picked.value.length) return 'Pick at least one band'
  if (allOn.value) return 'All supported bands allowed'
  return `Locked to ${picked.value.map((b) => `${P.value}${b}`).join(', ')}${dirty.value ? ' · not applied yet' : ''}`
})

function toggle(b: number): void {
  picked.value = picked.value.includes(b) ? picked.value.filter((x) => x !== b) : [...picked.value, b].sort((a, c) => a - c)
}

async function apply(): Promise<void> {
  const ok = await ask({
    title: `Apply ${NAME.value} bands?`,
    text: `The modem re-registers on the network to use the new bands, so the cellular link drops for a few seconds. ${props.group === 'lte' ? '5G' : 'LTE'} bands are not changed.`,
    confirm: 'Apply',
  })
  if (!ok) return
  const list = [...picked.value]
  const args = props.group === 'lte' ? { lte: list, reregister: true } : { sa: list, nsa: list, reregister: true }
  if (await run('apply', () => setBands(args), `${NAME.value} bands applied`)) emit('applied')
}
</script>

<template>
  <section :class="embedded ? 'hk-band-embedded' : 'hk-card'" :aria-label="`${NAME} band lock`" :style="embedded ? undefined : 'padding: 20px 24px; gap: 14px'">
    <div class="d-flex align-center flex-wrap ga-3">
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 v-if="!embedded" class="hk-h2">{{ NAME }} band lock</h2>
        <span class="text-muted" style="font-size: 13px">{{ lock ? summary : 'Reading bands…' }}</span>
      </div>
      <v-btn variant="text" color="primary" height="40" :disabled="!lock || allOn" @click="picked = [...supported]">Allow all</v-btn>
      <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !picked.length" :loading="busy.apply" @click="apply">Apply</v-btn>
    </div>
    <div v-if="lock" role="group" :aria-label="`${NAME} bands`" class="d-flex flex-wrap ga-2">
      <button
        v-for="b in supported"
        :key="b"
        type="button"
        class="hk-filter"
        :class="{ 'is-on': picked.includes(b) }"
        :aria-pressed="picked.includes(b) ? 'true' : 'false'"
        @click="toggle(b)"
      >
        <HkIcon v-if="picked.includes(b)" name="check" :size="16" :stroke="2.6" />{{ P }}{{ b }}
      </button>
    </div>
    <v-skeleton-loader v-else type="chip@6" bg-color="transparent" />
  </section>
</template>

<style scoped>
.hk-band-embedded {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hk-filter {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-on-surface-muted));
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.hk-filter.is-on {
  padding-left: 8px;
  border-color: rgb(var(--v-theme-secondary-container));
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-filter:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
</style>
