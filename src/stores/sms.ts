// Per-browser SMS memory:
//   sent  what this browser sent. The modem keeps received messages only,
//         so without this a conversation would show one side. It never
//         leaves this browser and other devices don't see it.
//   seen  newest message time looked at, per conversation: the modem gives
//         no read flag, so "unread" is this browser's view too.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { SentRecord } from '@/utils/sms'
import { load, save } from '@/utils/storage'

const KEY = 'hikari.sms'
const MAX_SENT = 300

export const useSmsMemory = defineStore('sms', () => {
  const saved = load<{ sent: SentRecord[]; seen: Record<string, number>; initialized: boolean }>(KEY, { sent: [], seen: {}, initialized: false })
  const sent = ref<SentRecord[]>(saved.sent)
  const seen = ref<Record<string, number>>(saved.seen)
  // False until the first inbox load in this browser: what's already there
  // then counts as read, instead of every old message showing as new.
  const initialized = ref(saved.initialized)

  watch([sent, seen, initialized], () => save(KEY, { sent: sent.value, seen: seen.value, initialized: initialized.value }), { deep: true })

  function recordSent(to: string, text: string): void {
    sent.value = [...sent.value, { to, text, at: Date.now() }].slice(-MAX_SENT)
  }
  function markSeen(key: string, at: number): void {
    if ((seen.value[key] ?? 0) < at) seen.value = { ...seen.value, [key]: at }
  }
  function forget(pred: (r: SentRecord) => boolean): void {
    sent.value = sent.value.filter((r) => !pred(r))
  }

  return { sent, seen, initialized, recordSent, markSeen, forget }
})
