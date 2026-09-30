<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { SmsList } from '@/api/modem'
import { joinSms } from '@/utils/cellular'

const props = withDefaults(defineProps<{ sms: SmsList | null; loading: boolean; title?: string; limit?: number }>(), { title: 'Messages', limit: 2 })

const threads = computed(() => (props.sms ? joinSms(props.sms.stores.flatMap((s) => s.msg.map((m) => ({ ...m, store: s.name })))) : []).slice(0, props.limit))

function when(ts: string): string {
  const d = new Date(ts.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ts
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
</script>

<template>
  <section class="hk-card" aria-label="Messages" style="padding-bottom: 14px; gap: 6px; flex-grow: 1">
    <div class="d-flex align-center mb-1">
      <h2 class="hk-h2 flex-grow-1">{{ title }}</h2>
      <router-link :to="{ path: '/cellular', query: { tab: 'sms' } }" class="hk-link" style="margin: 0 -12px 0 0">Inbox <HkIcon name="arrowRight" :size="18" /></router-link>
    </div>
    <template v-if="sms">
      <div v-for="(t, i) in threads" :key="i" class="hk-msg">
        <span class="hk-msg__icon" :class="{ first: i === 0 }"><HkIcon name="message" :size="20" /></span>
        <div class="d-flex flex-column flex-grow-1" style="min-width: 0; gap: 2px">
          <div class="d-flex" style="font-size: 14px">
            <span class="flex-grow-1" :style="{ fontWeight: i === 0 ? 700 : 600 }">{{ t.sender }}</span>
            <span class="hk-label">{{ when(t.timestamp) }}</span>
          </div>
          <span class="hk-msg__text">{{ t.text }}</span>
        </div>
      </div>
      <p v-if="!threads.length" class="text-muted py-2">No messages on the SIM or modem.</p>
    </template>
    <v-skeleton-loader v-else-if="loading" type="list-item-avatar-two-line@2" bg-color="transparent" />
  </section>
</template>

<style scoped>
.hk-msg {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
}
.hk-msg__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-msg__icon.first {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.hk-msg__text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
