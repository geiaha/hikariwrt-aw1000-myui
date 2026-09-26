<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import { saveMultiwan, type MultiwanFull } from '@/api/wan'
import type { MultiwanStatus } from '@/api/services'
import { useAction } from '@/composables/action'
import { luciUrl } from '@/nav'
import { uplinkLabel } from '@/utils/uplinks'
import { parseList } from '@/utils/validate'

// Multi-WAN: failover or load balance, which uplink comes first, how
// traffic is shared when balancing, and the SMS alert on a switch. Health
// check targets and timings stay in LuCI (rarely touched, easy to get wrong).
const props = defineProps<{ config: MultiwanFull | null; status: MultiwanStatus | null }>()
const emit = defineEmits<{ saved: [] }>()
const { busy, run } = useAction()

const form = ref<MultiwanFull | null>(null)
const recipients = ref('')
function reset(): void {
  // A plain deep copy: structuredClone refuses Vue's reactive proxies.
  form.value = props.config ? (JSON.parse(JSON.stringify(toRaw(props.config))) as MultiwanFull) : null
  recipients.value = props.config?.notify?.recipients.join(', ') ?? ''
}
watch(() => props.config, reset, { immediate: true, deep: true })

function move(i: number, d: -1 | 1): void {
  const l = form.value!.ifaces
  const j = i + d
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j]!, l[i]!]
}

const live = (name: string) => props.status?.interfaces.find((i) => i.name === name) ?? null
const next = computed<MultiwanFull | null>(() =>
  form.value ? { ...form.value, notify: form.value.notify ? { ...form.value.notify, recipients: parseList(recipients.value) } : null } : null,
)
const dirty = computed(() => JSON.stringify(next.value) !== JSON.stringify(props.config))
const smsError = computed(() =>
  next.value?.notify?.enabled && !next.value.notify.recipients.every((r) => /^\+?[0-9]{3,}$/.test(r))
    ? 'Phone numbers, separated by commas'
    : next.value?.notify?.enabled && !next.value.notify.recipients.length
      ? 'Who should get the alert?'
      : null,
)
const share = (w: number) => {
  const total = form.value?.ifaces.filter((f) => f.enabled).reduce((a, f) => a + f.weight, 0) || 1
  return Math.round((w / total) * 100)
}

async function save(): Promise<void> {
  if (!next.value) return
  if (await run('save', () => saveMultiwan(next.value!), 'Multi-WAN settings saved')) emit('saved')
}
</script>

<template>
  <section class="hk-card" aria-label="Multi-WAN settings" style="gap: 14px">
    <div class="d-flex align-center ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <h2 class="hk-h2">Multi-WAN</h2>
        <span class="text-muted" style="font-size: 13px">Use more than one uplink: keep one in reserve, or share traffic.</span>
      </div>
      <M3Switch v-if="form" v-model="form.enabled" label="Multi-WAN" />
    </div>

    <template v-if="form">
      <SegmentedButton
        v-model="form.mode"
        label="Multi-WAN mode"
        :disabled="!form.enabled"
        :options="[
          { value: 'failover', label: 'Failover' },
          { value: 'balance', label: 'Load balance' },
        ]"
      />
      <p class="text-muted" style="font-size: 13px; margin: 0">
        {{ form.mode === 'failover' ? 'Everything goes over the first uplink that works; the next one takes over when it fails.' : 'Connections are spread across working uplinks by their share.' }}
      </p>

      <ol class="hk-order">
        <li v-for="(f, i) in form.ifaces" :key="f.name" :class="{ off: !f.enabled }">
          <span class="hk-order__n">{{ i + 1 }}</span>
          <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
            <span class="font-weight-bold" style="font-size: 14px">{{ uplinkLabel(f.name) }}</span>
            <span class="hk-label">
              <template v-if="live(f.name)">
                {{ live(f.name)!.active ? 'In use' : live(f.name)!.status === 'online' ? 'Ready' : 'Offline' }}<template v-if="live(f.name)!.latency != null"> · {{ live(f.name)!.latency!.toFixed(0) }} ms</template>
              </template>
              <template v-else>No status</template>
            </span>
            <div v-if="form.mode === 'balance' && f.enabled" class="d-flex align-center ga-3 mt-1">
              <v-slider v-model="f.weight" :min="1" :max="10" :step="1" hide-details density="compact" color="primary" :aria-label="`${uplinkLabel(f.name)} share`" />
              <span class="hk-label" style="min-width: 36px; text-align: right">{{ share(f.weight) }}%</span>
            </div>
          </div>
          <div class="d-flex flex-column">
            <v-btn icon variant="text" size="small" :disabled="i === 0" :aria-label="`Move ${uplinkLabel(f.name)} up`" @click="move(i, -1)">
              <HkIcon name="arrowRight" :size="18" style="transform: rotate(-90deg)" />
            </v-btn>
            <v-btn icon variant="text" size="small" :disabled="i === form.ifaces.length - 1" :aria-label="`Move ${uplinkLabel(f.name)} down`" @click="move(i, 1)">
              <HkIcon name="arrowRight" :size="18" style="transform: rotate(90deg)" />
            </v-btn>
          </div>
          <M3Switch v-model="f.enabled" :label="`Use ${uplinkLabel(f.name)}`" />
        </li>
      </ol>

      <span class="hk-label">
        Health checks: {{ form.trackIp.join(', ') || 'none' }} every {{ form.interval }} s ·
        <a :href="luciUrl('admin/network/multiwan')" class="text-primary">change in LuCI</a>
      </span>

      <template v-if="form.notify">
        <div class="d-flex align-center ga-3">
          <span class="flex-grow-1" style="font-size: 14px">Text me when it switches</span>
          <M3Switch v-model="form.notify.enabled" label="SMS alert on switch" />
        </div>
        <div v-if="form.notify.enabled" class="hk-two">
          <v-text-field v-model="recipients" label="Phone numbers" inputmode="tel" hide-details="auto" :error-messages="smsError || undefined" />
          <v-select
            v-model="form.notify.throttle"
            :items="[
              { value: 60, title: 'At most every minute' },
              { value: 300, title: 'At most every 5 minutes' },
              { value: 900, title: 'At most every 15 minutes' },
              { value: 3600, title: 'At most every hour' },
            ]"
            label="How often"
            hide-details
          />
        </div>
      </template>

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" color="primary" height="40" :disabled="!dirty" @click="reset">Undo changes</v-btn>
        <v-btn variant="flat" color="primary" height="40" :disabled="!dirty || !!smsError" :loading="busy.save" @click="save">Save</v-btn>
      </div>
    </template>
    <p v-else class="text-muted">Multi-WAN isn’t installed on this router.</p>
  </section>
</template>

<style scoped>
.hk-order {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hk-order li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
  border-radius: 4px;
}
.hk-order li:first-child {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.hk-order li:last-child {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
.hk-order li.off .hk-order__n {
  opacity: 0.4;
}
.hk-order__n {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hk-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 599.98px) {
  .hk-two {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
