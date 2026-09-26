<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SmsAvatar from './SmsAvatar.vue'
import type { ChatMessage, Conversation } from '@/utils/sms'
import { conversationKey, isNumber, layoutBubbles, splitLinks } from '@/utils/sms'
import { smsLength } from '@/utils/cellular'

export interface Pending {
  id: string
  to: string
  text: string
  at: number
  status: 'sending' | 'failed'
  error?: string
}

// Right pane: the conversation as bubbles (received on the left in a
// surface tone, sent on the right in primary-container), day chips, and the
// composer. With `conversation` null it is a new chat with a "To" field.
const props = defineProps<{
  conversation: Conversation | null
  pending: Pending[]
  showBack: boolean
  busy: Record<string, boolean>
}>()
const emit = defineEmits<{
  send: [to: string, text: string]
  retry: [p: Pending]
  deleteMessage: [m: ChatMessage]
  deleteConversation: []
  back: []
}>()

const to = ref('')
const draft = ref('')
const picked = ref<string | null>(null)
const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

const isNew = computed(() => !props.conversation)
const target = computed(() => props.conversation?.name ?? to.value.trim())
const canReply = computed(() => (props.conversation ? props.conversation.replyable : isNumber(to.value)))
const len = computed(() => smsLength(draft.value))
const showCount = computed(() => len.value.encoding === 'UCS-2' || len.value.used > len.value.max * 0.6)

const mine = computed(() => {
  const k = target.value ? conversationKey(target.value) : ''
  return props.pending.filter((p) => conversationKey(p.to) === k)
})
const bubbles = computed(() => layoutBubbles(props.conversation?.messages ?? []))

function time(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function send(): void {
  const text = draft.value
  if (!text.trim() || !len.value.fits || !canReply.value) return
  emit('send', target.value, text)
  draft.value = ''
  nextTick(() => input.value?.focus())
}

function onKey(e: KeyboardEvent): void {
  // Enter sends, Shift+Enter is a new line (as in Messages for web).
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

function autosize(): void {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

async function toBottom(): Promise<void> {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
}
watch(() => [props.conversation?.key, bubbles.value.length, mine.value.length], toBottom, { immediate: true })
watch(draft, () => nextTick(autosize))
watch(
  () => props.conversation?.key,
  () => {
    picked.value = null
    draft.value = ''
  },
)
</script>

<template>
  <div class="hk-thread">
    <header class="hk-thread__head">
      <v-btn v-if="showBack" icon variant="text" width="48" height="48" aria-label="Back to conversations" @click="emit('back')">
        <HkIcon name="arrowLeft" />
      </v-btn>
      <template v-if="conversation">
        <SmsAvatar :name="conversation.name" :ckey="conversation.key" :size="40" />
        <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
          <span class="hk-thread__name">{{ conversation.name }}</span>
          <span class="hk-label">{{ conversation.replyable ? 'Mobile' : 'Business sender' }}</span>
        </div>
        <v-btn icon variant="text" width="48" height="48" aria-label="Delete conversation" :loading="busy.conv" @click="emit('deleteConversation')">
          <HkIcon name="trash" />
        </v-btn>
      </template>
      <template v-else>
        <span class="hk-h2 flex-grow-1" style="font-size: 18px">New conversation</span>
      </template>
    </header>

    <div v-if="isNew" class="hk-thread__to">
      <label for="hk-to" class="hk-label" style="font-size: 14px">To</label>
      <input id="hk-to" v-model="to" type="tel" placeholder="Type a phone number" autocomplete="off" autofocus />
    </div>

    <div ref="scroller" class="hk-thread__scroll" role="log" aria-live="polite" :aria-label="conversation ? `Messages with ${conversation.name}` : 'New conversation'">
      <template v-for="b in bubbles" :key="b.id">
        <div v-if="b.day" class="hk-day"><span>{{ b.day }}</span></div>
        <div class="hk-row" :class="[b.dir, { first: b.first, last: b.last }]">
          <SmsAvatar v-if="b.dir === 'in' && conversation" :name="conversation.name" :ckey="conversation.key" :size="32" :class="{ ghost: !b.last }" />
          <div class="hk-col">
            <button type="button" class="hk-bubble" :aria-pressed="picked === b.id ? 'true' : 'false'" @click="picked = picked === b.id ? null : b.id">
              <template v-for="(p, i) in splitLinks(b.text)" :key="i">
                <a v-if="p.href" :href="p.href" target="_blank" rel="noopener noreferrer" @click.stop>{{ p.text }}</a>
                <template v-else>{{ p.text }}</template>
              </template>
            </button>
            <div v-if="b.last || picked === b.id" class="hk-meta">
              <span>{{ time(b.at) }}<template v-if="b.dir === 'out'"> · Sent from this browser</template></span>
              <button v-if="picked === b.id" type="button" class="hk-meta__del" :disabled="busy[`m:${b.id}`]" @click="emit('deleteMessage', b)">
                {{ b.dir === 'in' ? 'Delete' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>
      </template>
      <div v-for="p in mine" :key="p.id" class="hk-row out first last">
        <div class="hk-col">
          <div class="hk-bubble" :class="{ failed: p.status === 'failed' }">{{ p.text }}</div>
          <div class="hk-meta" :class="{ 'text-error': p.status === 'failed' }">
            <template v-if="p.status === 'sending'">Sending…</template>
            <template v-else>
              Not sent<template v-if="p.error">: {{ p.error }}</template> ·
              <button type="button" class="hk-meta__del" @click="emit('retry', p)">Retry</button>
            </template>
          </div>
        </div>
      </div>
      <p v-if="conversation && !bubbles.length && !mine.length" class="text-muted text-center py-8">No messages.</p>
    </div>

    <div class="hk-compose">
      <p v-if="conversation && !conversation.replyable" class="hk-noreply">You can’t reply to this sender.</p>
      <template v-else>
        <div class="hk-compose__field">
          <textarea
            ref="input"
            v-model="draft"
            rows="1"
            placeholder="Text message"
            aria-label="Text message"
            :disabled="isNew && !canReply"
            @keydown="onKey"
          />
          <span v-if="showCount && draft" class="hk-compose__count" :class="{ 'text-error': !len.fits }">{{ len.used }}/{{ len.max }}</span>
        </div>
        <button type="button" class="hk-send" aria-label="Send SMS" :disabled="!draft.trim() || !len.fits || !canReply" @click="send">
          <HkIcon name="send" :size="22" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hk-thread {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.hk-thread__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
.hk-thread__name {
  font-size: 18px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hk-thread__to {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
.hk-thread__to input {
  flex-grow: 1;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 16px;
  color: rgb(var(--v-theme-on-surface));
}
.hk-thread__scroll {
  flex-grow: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
}
.hk-day {
  display: flex;
  justify-content: center;
  margin: 16px 0 8px;
}
.hk-day span {
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 2px;
}
.hk-row.first {
  margin-top: 8px;
}
.hk-row.out {
  justify-content: flex-end;
}
.hk-row .ghost {
  visibility: hidden;
}
/* The last bubble of a run carries its time underneath; lift the avatar so
   it sits beside the bubble, not the timestamp. */
.hk-row.in.last > .hk-avatar {
  margin-bottom: 22px;
}
.hk-col {
  display: flex;
  flex-direction: column;
  max-width: min(72%, 560px);
  min-width: 0;
}
.out .hk-col {
  align-items: flex-end;
}
.hk-bubble {
  display: block;
  padding: 10px 14px;
  border: 0;
  border-radius: 20px;
  font: inherit;
  font-size: 15px;
  line-height: 1.4;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: pointer;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface));
}
.out .hk-bubble {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
/* Runs: the corners that face the neighbouring bubble tighten. */
.in:not(.first) .hk-bubble {
  border-top-left-radius: 4px;
}
.in:not(.last) .hk-bubble {
  border-bottom-left-radius: 4px;
}
.out:not(.first) .hk-bubble {
  border-top-right-radius: 4px;
}
.out:not(.last) .hk-bubble {
  border-bottom-right-radius: 4px;
}
.hk-bubble[aria-pressed='true'] {
  filter: brightness(0.94);
}
.hk-bubble.failed {
  background: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
}
.hk-bubble a {
  color: inherit;
  text-decoration: underline;
}
.hk-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-muted));
  padding: 4px 6px 2px;
}
.hk-meta__del {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.hk-compose {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px 12px 16px;
}
.hk-compose__field {
  flex-grow: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 48px;
  padding: 12px 18px;
  border-radius: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  box-sizing: border-box;
}
.hk-compose__field textarea {
  flex-grow: 1;
  resize: none;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  line-height: 24px;
  max-height: 160px;
  color: rgb(var(--v-theme-on-surface));
}
.hk-compose__count {
  font-size: 12px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-muted));
  white-space: nowrap;
}
/* Vuetify's text-error is a layered utility; our scoped colours win over
   it, so the error state is spelled out here. */
.hk-compose__count.text-error,
.hk-meta.text-error {
  color: rgb(var(--v-theme-error));
}
.hk-send {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
}
.hk-send:disabled {
  background: rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.38);
  cursor: default;
}
.hk-send:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
}
.hk-noreply {
  flex-grow: 1;
  margin: 0;
  padding: 14px;
  text-align: center;
  font-size: 13px;
  border-radius: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface-muted));
}
</style>
