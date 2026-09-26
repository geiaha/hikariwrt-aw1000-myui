<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import type { UplinkView } from '@/composables/home'
import type { MultiwanConfig } from '@/api/services'
import { setMultiwanMode } from '@/api/services'
import { useAction } from '@/composables/action'

const props = defineProps<{ uplinks: UplinkView[] | null; config: MultiwanConfig | null }>()
const emit = defineEmits<{ changed: [] }>()
const { busy, run } = useAction()

// Local copy, set optimistically: the config prop comes from the 15 s poll,
// and a stale prop would make the segment you just left look still chosen
// (so clicking it back would do nothing). Reverts if the write fails.
const local = ref<'failover' | 'balance'>(props.config?.mode ?? 'failover')
watch(
  () => props.config?.mode,
  (m) => {
    if (m && !busy.value.mode) local.value = m
  },
)
const mode = computed({
  get: () => local.value,
  set: async (m: 'failover' | 'balance') => {
    const was = local.value
    local.value = m
    const ok = await run('mode', () => setMultiwanMode(m), m === 'balance' ? 'Multi-WAN now balances load across uplinks' : 'Multi-WAN now uses failover')
    if (ok) emit('changed')
    else local.value = was
  },
})

// "to ••••904": enough to recognise your own number without showing it.
const alert = computed(() => {
  const n = props.config?.notify
  if (!n?.enabled || !n.recipients.length) return 'No SMS alert on switch'
  const who = n.recipients.map((r) => `••••${r.slice(-3)}`).join(', ')
  return `SMS alert on switch · to ${who}`
})

const WORD = { active: 'in use', standby: 'ready', down: 'offline' } as const
</script>

<template>
  <section class="hk-card" aria-label="Multi-WAN" style="gap: 14px">
    <h2 class="hk-h2">Multi-WAN</h2>
    <template v-if="config">
      <SegmentedButton
        v-model="mode"
        label="Multi-WAN mode"
        :disabled="busy.mode"
        :options="[
          { value: 'failover', label: 'Failover' },
          { value: 'balance', label: 'Load balance' },
        ]"
      />
      <ol class="hk-prio">
        <li v-for="(u, i) in uplinks ?? []" :key="u.name" :class="`is-${u.state}`">
          <span class="hk-prio__n">{{ i + 1 }}</span>
          <span class="hk-prio__name">{{ u.label }}</span>
          <span class="hk-prio__state">{{ WORD[u.state] }}</span>
        </li>
      </ol>
      <span class="text-muted" style="font-size: 13px">{{ alert }}</span>
    </template>
    <p v-else class="text-body-medium text-muted">Multi-WAN isn't installed on this router.</p>
  </section>
</template>

<style scoped>
.hk-prio {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hk-prio li {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
}
.hk-prio__n {
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.is-active .hk-prio__n {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hk-prio__name {
  flex-grow: 1;
  font-weight: 600;
  font-size: 14px;
}
.hk-prio__state {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.is-active .hk-prio__state {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.is-down .hk-prio__state {
  color: rgb(var(--v-theme-error));
}
</style>
