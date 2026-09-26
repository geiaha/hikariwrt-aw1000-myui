<script setup lang="ts">
import { computed, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SmsAvatar from './SmsAvatar.vue'
import type { Conversation } from '@/utils/sms'
import { listTime } from '@/utils/sms'
import type { SmsList } from '@/api/modem'

// Left pane: search, conversations newest first (unread in bold with a
// dot), an overflow menu for storage and bulk actions, and "Start chat".
const props = defineProps<{
  conversations: Conversation[]
  selected: string | null
  unread: (c: Conversation) => boolean
  sms: SmsList | null
  loading: boolean
  busy: Record<string, boolean>
}>()
const emit = defineEmits<{
  select: [key: string]
  compose: []
  refresh: []
  deleteAll: []
  store: [storage: 'ME' | 'SM']
}>()

const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.conversations
  return props.conversations.filter((c) => c.name.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
})
const storeLine = computed(() => props.sms?.stores.map((s) => `${s.label} ${s.used}/${s.total}`).join(' · ') ?? '')
</script>

<template>
  <div class="hk-clist">
    <div class="hk-clist__head">
      <label class="hk-clist__search">
        <HkIcon name="search" class="text-muted" />
        <input v-model="query" type="search" placeholder="Search conversations" aria-label="Search conversations" />
      </label>
      <v-menu location="bottom end">
        <template #activator="{ props: p }">
          <v-btn v-bind="p" icon variant="text" width="48" height="48" aria-label="More options">
            <HkIcon name="moreVert" />
          </v-btn>
        </template>
        <v-list bg-color="surface-container" rounded="lg" min-width="260">
          <v-list-subheader>{{ storeLine || 'Messages' }}</v-list-subheader>
          <v-list-item title="Refresh" :disabled="busy.refresh" @click="emit('refresh')">
            <template #prepend><HkIcon name="refresh" class="mr-4" /></template>
          </v-list-item>
          <v-list-item
            :title="`Store new messages on the ${sms?.incoming === 'SM' ? 'modem' : 'SIM'}`"
            :subtitle="`Now: ${sms?.incoming === 'SM' ? 'SIM card' : 'modem memory'}`"
            :disabled="!sms || busy.store"
            @click="emit('store', sms?.incoming === 'SM' ? 'ME' : 'SM')"
          >
            <template #prepend><HkIcon name="sim" class="mr-4" /></template>
          </v-list-item>
          <v-list-item title="Delete all messages" base-color="error" :disabled="!conversations.length" @click="emit('deleteAll')">
            <template #prepend><HkIcon name="trash" class="mr-4" /></template>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <div class="hk-clist__items" role="list">
      <button
        v-for="c in shown"
        :key="c.key"
        type="button"
        role="listitem"
        class="hk-conv"
        :class="{ 'is-on': c.key === selected, 'is-unread': unread(c) }"
        :aria-current="c.key === selected ? 'true' : undefined"
        @click="emit('select', c.key)"
      >
        <SmsAvatar :name="c.name" :ckey="c.key" />
        <span class="hk-conv__text">
          <span class="hk-conv__top">
            <span class="hk-conv__name">{{ c.name }}</span>
            <span class="hk-conv__time">{{ listTime(c.last.at) }}</span>
          </span>
          <span class="hk-conv__snippet">
            <template v-if="c.last.dir === 'out'">You: </template>{{ c.last.text }}
          </span>
        </span>
        <span v-if="unread(c)" class="hk-conv__dot" aria-label="Unread" />
      </button>
      <p v-if="!loading && !shown.length" class="text-muted px-4 py-6 text-center">
        {{ query ? 'No conversations match.' : 'No messages yet.' }}
      </p>
      <v-skeleton-loader v-if="loading && !conversations.length" type="list-item-avatar-two-line@4" bg-color="transparent" />
    </div>

    <button type="button" class="hk-startchat" @click="emit('compose')">
      <HkIcon name="chatPlus" />Start chat
    </button>
  </div>
</template>

<style scoped>
.hk-clist {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.hk-clist__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 8px 8px 12px;
}
.hk-clist__search {
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  border-radius: 24px;
  background: rgb(var(--v-theme-surface-container-high));
}
.hk-clist__search input {
  flex-grow: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: rgb(var(--v-theme-on-surface));
}
.hk-clist__items {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 8px 88px;
}
.hk-conv {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 0;
  border-radius: 28px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.hk-conv:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.hk-conv.is-on {
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-conv:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: -3px;
}
.hk-conv__text {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hk-conv__top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.hk-conv__name {
  flex-grow: 1;
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hk-conv__time {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-muted));
  white-space: nowrap;
}
.hk-conv__snippet {
  font-size: 14px;
  color: rgb(var(--v-theme-on-surface-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-on .hk-conv__time,
.is-on .hk-conv__snippet {
  color: inherit;
  opacity: 0.8;
}
.is-unread .hk-conv__name,
.is-unread .hk-conv__snippet,
.is-unread .hk-conv__time {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}
.hk-conv__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.hk-startchat {
  position: absolute;
  right: 16px;
  bottom: 16px;
  height: 56px;
  padding: 0 20px 0 16px;
  border-radius: 16px;
  border: 0;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 8px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}
.hk-startchat:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
</style>
