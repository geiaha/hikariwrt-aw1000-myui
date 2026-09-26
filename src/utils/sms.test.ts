import { describe, expect, it } from 'vitest'
import { avatarSlot, conversationKey, dayLabel, groupConversations, initial, layoutBubbles, parseStamp } from './sms'

describe('conversationKey', () => {
  it('matches the same number written differently', () => {
    const k = conversationKey('+63 924 114 8904')
    expect(conversationKey('09241148904')).toBe(k)
    expect(conversationKey('639241148904')).toBe(k)
  })
  it('keys names case-insensitively', () => {
    expect(conversationKey('DITO')).toBe(conversationKey('dito'))
    expect(conversationKey('DITO')).not.toBe(conversationKey('+639241148904'))
  })
})

describe('groupConversations', () => {
  const threads = [
    { sender: 'DITO', timestamp: '2026-09-26 04:45:43', text: 'Welcome', specs: ['ME:0', 'ME:1'] },
    { sender: '+639241148904', timestamp: '2026-09-26 09:00:00', text: 'hi', specs: ['SM:2'] },
  ]
  it('merges sent copies into the matching conversation, newest first', () => {
    const at = parseStamp('2026-09-26 09:05:00')
    const c = groupConversations(threads, [{ to: '09241148904', text: 'hello back', at }])
    expect(c.map((x) => x.name)).toEqual(['+639241148904', 'DITO'])
    expect(c[0]!.messages.map((m) => m.dir)).toEqual(['in', 'out'])
    expect(c[0]!.replyable).toBe(true)
    expect(c[1]!.replyable).toBe(false)
  })
})

it('avatars', () => {
  expect(initial('DITO')).toBe('D')
  expect(initial('+63 912')).toBeNull()
  expect(avatarSlot('name:dito')).toBe(avatarSlot('name:dito'))
  expect(avatarSlot('x')).toBeLessThan(4)
})

it('day labels', () => {
  const now = parseStamp('2026-09-27 10:00:00')
  expect(dayLabel(parseStamp('2026-09-27 01:00:00'), now)).toBe('Today')
  expect(dayLabel(parseStamp('2026-09-26 23:00:00'), now)).toBe('Yesterday')
})

it('bubble runs and day chips', () => {
  const t = parseStamp('2026-09-26 09:00:00')
  const b = layoutBubbles([
    { id: '1', dir: 'in', text: 'a', at: t, specs: [] },
    { id: '2', dir: 'in', text: 'b', at: t + 30000, specs: [] },
    { id: '3', dir: 'out', text: 'c', at: t + 60000, specs: [] },
    { id: '4', dir: 'out', text: 'd', at: t + 86400000, specs: [] },
  ], t + 86400000)
  expect(b.map((x) => [x.first, x.last])).toEqual([[true, false], [false, true], [true, true], [true, true]])
  expect(b[0]!.day).toBe('Yesterday')
  expect(b[1]!.day).toBeNull()
  expect(b[3]!.day).toBe('Today')
})

it('splits links out of text', async () => {
  const { splitLinks } = await import('./sms')
  expect(splitLinks('see https://dito.ph/x?a=1. thanks')).toEqual([
    { text: 'see ' },
    { text: 'https://dito.ph/x?a=1', href: 'https://dito.ph/x?a=1' },
    { text: '. thanks' },
  ])
  expect(splitLinks('no links')).toEqual([{ text: 'no links' }])
})
