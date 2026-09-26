// Conversation model for the SMS page (Google Messages style). Pure, so it
// is unit tested. The modem stores received messages only; messages sent
// from this browser are remembered locally (see stores/sms.ts) and merged
// in here so a conversation reads both ways.

import type { SmsThread } from './cellular'

export interface ChatMessage {
  id: string
  dir: 'in' | 'out'
  text: string
  /** ms since epoch */
  at: number
  /** smsdelete specs for received messages; empty for local sent copies. */
  specs: string[]
}

export interface Conversation {
  key: string
  /** Number or sender name as the modem shows it. */
  name: string
  /** Alphanumeric senders (carriers, banks) can't be replied to. */
  replyable: boolean
  messages: ChatMessage[]
  last: ChatMessage
}

export interface SentRecord {
  to: string
  text: string
  at: number
}

/** "2026-09-26 04:45:43" (modem local time) -> ms. */
export function parseStamp(ts: string): number {
  const t = new Date(ts.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * One key per correspondent: digits only, compared on the last 10 so
 * "+63 924 114 8904", "09241148904" and "639241148904" meet. Names (DITO)
 * are keyed case-insensitively.
 */
export function conversationKey(sender: string): string {
  const s = sender.trim()
  if (!isNumber(s)) return `name:${s.toLowerCase()}`
  const d = s.replace(/\D/g, '')
  return `num:${d.length > 10 ? d.slice(-10) : d}`
}

export function isNumber(s: string): boolean {
  return /^\+?[0-9][0-9 ()-]{2,}$/.test(s.trim())
}

export function groupConversations(threads: SmsThread[], sent: SentRecord[]): Conversation[] {
  const map = new Map<string, Conversation>()
  const get = (name: string) => {
    const key = conversationKey(name)
    let c = map.get(key)
    if (!c) {
      c = { key, name, replyable: isNumber(name), messages: [], last: null as unknown as ChatMessage }
      map.set(key, c)
    }
    return c
  }
  threads.forEach((t) =>
    get(t.sender).messages.push({ id: `in:${t.specs.join(',') || t.timestamp}`, dir: 'in', text: t.text, at: parseStamp(t.timestamp), specs: t.specs }),
  )
  sent.forEach((s, i) => get(s.to).messages.push({ id: `out:${s.at}:${i}`, dir: 'out', text: s.text, at: s.at, specs: [] }))
  const list = [...map.values()]
  for (const c of list) {
    c.messages.sort((a, b) => a.at - b.at)
    c.last = c.messages[c.messages.length - 1]!
  }
  return list.sort((a, b) => b.last.at - a.last.at)
}

/** Initial for the avatar: first letter, or null for numbers (person icon). */
export function initial(name: string): string | null {
  if (isNumber(name)) return null
  const m = name.trim().match(/\p{L}|\p{N}/u)
  return m ? m[0].toUpperCase() : null
}

/** Stable avatar colour slot 0..3 from the name. */
export function avatarSlot(key: string): number {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 4
}

function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Date chip between message groups: Today, Yesterday, "Sat, Sep 26", "Sep 26, 2025". */
export function dayLabel(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
}

/** List timestamp: time today, weekday this week, else date. */
export function listTime(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86400000)
  const d = new Date(t)
  if (diff === 0) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export interface Bubble extends ChatMessage {
  /** First/last of a run from the same side within 2 minutes: shapes corners. */
  first: boolean
  last: boolean
  /** Date chip to draw above this bubble, if it starts a new day. */
  day: string | null
}

export function layoutBubbles(msgs: ChatMessage[], now = Date.now()): Bubble[] {
  const RUN = 2 * 60 * 1000
  return msgs.map((m, i) => {
    const prev = msgs[i - 1]
    const next = msgs[i + 1]
    const newDay = !prev || startOfDay(prev.at) !== startOfDay(m.at)
    const joinsPrev = !!prev && !newDay && prev.dir === m.dir && m.at - prev.at < RUN
    const joinsNext = !!next && startOfDay(next.at) === startOfDay(m.at) && next.dir === m.dir && next.at - m.at < RUN
    return { ...m, first: !joinsPrev, last: !joinsNext, day: newDay ? dayLabel(m.at, now) : null }
  })
}

export interface TextPart {
  text: string
  href?: string
}

/** Split message text into plain runs and http(s) links (rendered as <a>, never HTML). */
export function splitLinks(text: string): TextPart[] {
  const out: TextPart[] = []
  const re = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/gi
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], href: m[0] })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}
