<script setup lang="ts">
import { computed } from 'vue'
import ProgressRing from '@/components/m3/ProgressRing.vue'
import type { UsageInfo } from '@/api/modem'
import { bytes } from '@/utils/format'

const props = defineProps<{ usage: UsageInfo | null }>()

const limited = computed(() => (props.usage?.settings.limit ?? 0) > 0)
const resets = computed(() => {
  const n = props.usage?.period.next
  return n ? new Date(`${n}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
})
</script>

<template>
  <section class="hk-card" aria-label="Data this month" style="gap: 14px">
    <h2 class="hk-h2">Data this month</h2>
    <div v-if="usage?.ok" class="d-flex align-center ga-5">
      <ProgressRing v-if="limited" :value="usage.cycle.percent" label="Data used">
        <span class="hk-display" style="font-size: 22px; font-weight: 600">{{ usage.cycle.percent }}%</span>
      </ProgressRing>
      <div class="d-flex flex-column ga-1" style="font-size: 13px">
        <span class="hk-display" style="font-size: 24px; line-height: 1.2">{{ bytes(usage.cycle.total) }}</span>
        <span class="text-muted">{{ limited ? `of ${usage.cycle.limit_human} plan` : 'No monthly limit set' }}</span>
        <span class="text-muted">Resets {{ resets }} · day {{ usage.period.elapsed }} of {{ usage.period.days }}</span>
      </div>
    </div>
    <p v-else-if="usage" class="text-muted">Usage tracking is off.</p>
    <v-skeleton-loader v-else type="text@2" bg-color="transparent" />
  </section>
</template>
