<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import HkIcon from '@/components/icons/HkIcon.vue'
import ConversationList from '@/components/sms/ConversationList.vue'
import ThreadView, { type Pending } from '@/components/sms/ThreadView.vue'
import * as modem from '@/api/modem'
import type { SmsList } from '@/api/modem'
import { useAction } from '@/composables/action'
import { useConfirm } from '@/composables/confirm'
import { useSmsMemory } from '@/stores/sms'
import { joinSms } from '@/utils/cellular'
import { conversationKey, groupConversations, type ChatMessage, type Conversation } from '@/utils/sms'

// SMS in the shape of Google Messages: conversations on the left, the open
// one on the right; on phones, one at a time. The open conversation lives
// in the URL (?tab=sms&c=<key>, &new=1 for a new chat) so Back works.
// Listing talks to the modem: on open, on Refresh and after each write,
// never on a timer.

const route = useRoute()
const router = useRouter()
const { xs, mdAndUp } = useDisplay()
const { busy, run } = useAction()
const { ask } = useConfirm()
const memory = useSmsMemory()

const sms = ref<SmsList | null>(null)
const error = ref('')
const loading = ref(true)
const pending = ref<Pending[]>([])

async function load(fresh = false): Promise<void> {
  error.value = ''
  try {
    const r = fresh ? await modem.smsRefresh() : await modem.smslist()
    if (!r.ok) throw new Error(r.error || 'The modem did not list messages.')
    sms.value = r
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => load())

const conversations = computed<Conversation[]>(() => {
  const threads = sms.value ? joinSms(sms.value.stores.flatMap((s) => s.msg.map((m) => ({ ...m, store: s.name })))) : []
  return groupConversations(threads, memory.sent)
})

// First load in this browser: everything already there counts as read.
watch(conversations, (list) => {
  if (memory.initialized || !sms.value) return
  list.forEach((c) => markRead(c))
  memory.initialized = true
})

const lastIn = (c: Conversation) => [...c.messages].reverse().find((m) => m.dir === 'in')?.at ?? 0
const unread = (c: Conversation) => lastIn(c) > (memory.seen[c.key] ?? 0)
function markRead(c: Conversation): void {
  memory.markSeen(c.key, lastIn(c))
}

const selectedKey = computed(() => (typeof route.query.c === 'string' ? route.query.c : null))
const composing = computed(() => route.query.new === '1')
const current = computed(() => conversations.value.find((c) => c.key === selectedKey.value) ?? null)
watch(current, (c) => c && markRead(c), { immediate: true })

function open(key: string | null, compose = false): void {
  const q: Record<string, string> = { tab: 'sms' }
  if (key) q.c = key
  if (compose) q.new = '1'
  // Phones stack list -> thread, so opening pushes (Back returns to the
  // list); on wide screens switching conversations just replaces.
  if (xs.value && (key || compose)) router.push({ query: q })
  else router.replace({ query: q })
}
function back(): void {
  if (window.history.state?.back) router.back()
  else open(null)
}

function adopt(r: modem.WriteReply<SmsList>): modem.WriteReply<SmsList> {
  if (r.state?.ok) sms.value = r.state
  return r
}

// ---- sending: a pending bubble until the modem says yes or no ----
async function send(to: string, text: string, retryOf?: Pending): Promise<void> {
  if (retryOf) pending.value = pending.value.filter((p) => p.id !== retryOf.id)
  const p: Pending = { id: `p${Date.now()}`, to, text, at: Date.now(), status: 'sending' }
  pending.value = [...pending.value, p]
  if (composing.value) router.replace({ query: { tab: 'sms', c: conversationKey(to) } })
  try {
    const r = await modem.smsSend(to, text)
    if (!r.ok) throw new Error(r.error || 'The modem refused it.')
    memory.recordSent(to, text)
    pending.value = pending.value.filter((x) => x.id !== p.id)
    adopt(r)
  } catch (e) {
    pending.value = pending.value.map((x) => (x.id === p.id ? { ...x, status: 'failed', error: e instanceof Error ? e.message : String(e) } : x))
  }
}

async function deleteMessage(m: ChatMessage): Promise<void> {
  if (m.dir === 'out') {
    // A sent copy only exists in this browser; removing it needs no modem.
    memory.forget((r) => r.at === m.at && r.text === m.text)
    return
  }
  const ok = await ask({ title: 'Delete message?', text: 'It’s removed from the modem or SIM. This can’t be undone.', confirm: 'Delete', destructive: true })
  if (ok) await run(`m:${m.id}`, async () => adopt(await modem.smsDelete(m.specs)), 'Message deleted')
}

async function deleteConversation(): Promise<void> {
  const c = current.value
  if (!c) return
  const ok = await ask({
    title: 'Delete this conversation?',
    text: `Every message with ${c.name} is deleted from the modem and SIM, and your sent copies from this browser. This can’t be undone.`,
    confirm: 'Delete',
    destructive: true,
  })
  if (!ok) return
  const specs = c.messages.flatMap((m) => m.specs)
  const done = await run('conv', async () => (specs.length ? adopt(await modem.smsDelete(specs)) : undefined), 'Conversation deleted')
  if (done) {
    memory.forget((r) => conversationKey(r.to) === c.key)
    open(null)
  }
}

async function deleteAll(): Promise<void> {
  const ok = await ask({
    title: 'Delete all messages?',
    text: 'Every message on the modem and SIM is deleted, and the sent copies kept in this browser. This can’t be undone.',
    confirm: 'Delete all',
    destructive: true,
  })
  if (!ok) return
  if (await run('all', async () => adopt(await modem.smsDeleteAll('all')), 'All messages deleted')) {
    memory.forget(() => true)
    open(null)
  }
}

const setStore = (s: 'ME' | 'SM') => run('store', async () => adopt(await modem.smsStorage(s, true)), `New messages now go to the ${s === 'SM' ? 'SIM' : 'modem'}`)

const showThread = computed(() => !!current.value || composing.value)
</script>

<template>
  <v-alert v-if="error" type="error" variant="tonal" rounded="xl">{{ error }}</v-alert>

  <!-- Wide: two panes in one card -->
  <section v-if="!xs" class="hk-msgs" aria-label="Messages">
    <div class="hk-msgs__list" :class="{ narrow: !mdAndUp }">
      <ConversationList
        :conversations="conversations"
        :selected="selectedKey"
        :unread="unread"
        :sms="sms"
        :loading="loading"
        :busy="busy"
        @select="open($event)"
        @compose="open(null, true)"
        @refresh="run('refresh', () => load(true))"
        @delete-all="deleteAll"
        @store="setStore"
      />
    </div>
    <div class="hk-msgs__thread">
      <ThreadView
        v-if="showThread"
        :conversation="current"
        :pending="pending"
        :show-back="false"
        :busy="busy"
        @send="send"
        @retry="(p) => send(p.to, p.text, p)"
        @delete-message="deleteMessage"
        @delete-conversation="deleteConversation"
      />
      <div v-else class="hk-msgs__empty">
        <span class="hk-msgs__emptyicon"><HkIcon name="message" :size="40" /></span>
        <p class="hk-h2" style="font-size: 20px">Pick a conversation</p>
        <p class="text-muted" style="font-size: 14px">Or start a new chat. Messages sent from here are kept in this browser; the modem keeps only what it receives.</p>
      </div>
    </div>
  </section>

  <!-- Phone: list, and the thread as a full-screen layer -->
  <template v-else>
    <section class="hk-msgs hk-msgs--phone" aria-label="Messages">
      <ConversationList
        :conversations="conversations"
        :selected="null"
        :unread="unread"
        :sms="sms"
        :loading="loading"
        :busy="busy"
        @select="open($event)"
        @compose="open(null, true)"
        @refresh="run('refresh', () => load(true))"
        @delete-all="deleteAll"
        @store="setStore"
      />
    </section>
    <div v-if="showThread" class="hk-msgs__layer">
      <ThreadView
        :conversation="current"
        :pending="pending"
        :show-back="true"
        :busy="busy"
        @send="send"
        @retry="(p) => send(p.to, p.text, p)"
        @delete-message="deleteMessage"
        @delete-conversation="deleteConversation"
        @back="back"
      />
    </div>
  </template>
</template>

<style scoped>
.hk-msgs {
  display: flex;
  height: max(520px, calc(100dvh - 236px));
  border-radius: var(--hk-r-card);
  background: rgb(var(--v-theme-surface-container-low));
  overflow: hidden;
}
.hk-msgs__list {
  width: 380px;
  flex-shrink: 0;
  border-right: 1px solid rgb(var(--v-theme-outline-variant));
  min-height: 0;
}
.hk-msgs__list.narrow {
  width: 320px;
}
.hk-msgs__thread {
  flex-grow: 1;
  min-width: 0;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
}
.hk-msgs__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
}
.hk-msgs__empty p {
  margin: 0;
}
.hk-msgs__emptyicon {
  width: 88px;
  height: 88px;
  border-radius: 44px;
  display: grid;
  place-items: center;
  margin-bottom: 8px;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-msgs--phone {
  height: calc(100dvh - 64px - 80px - 190px);
  min-height: 420px;
}
.hk-msgs--phone :deep(.hk-startchat) {
  position: fixed;
  bottom: 96px;
  z-index: 1004;
}
.hk-msgs__layer {
  position: fixed;
  inset: 0;
  z-index: 1010;
  background: rgb(var(--v-theme-surface));
}
</style>
