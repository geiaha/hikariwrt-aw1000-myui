import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: [string, string, Record<string, unknown>][] = []
vi.mock('./ubus', () => ({
  UbusError: class extends Error {
    code = 0
  },
  call: vi.fn(async (object: string, method: string, args: Record<string, unknown>) => {
    calls.push([object, method, args])
    return {}
  }),
}))

import { set } from './uci'

describe('uci.set', () => {
  beforeEach(() => {
    calls.length = 0
  })
  it('passes values through', async () => {
    await set('multiwan', 'notify', { enabled: '0', recipient: ['+639170000000'] })
    expect(calls).toEqual([['uci', 'set', { config: 'multiwan', section: 'notify', values: { enabled: '0', recipient: ['+639170000000'] } }]])
  })
  it('deletes an option set to an empty list instead of sending it (rpcd: Invalid argument)', async () => {
    await set('multiwan', 'notify', { enabled: '0', recipient: [], throttle: '300' })
    expect(calls).toEqual([
      ['uci', 'set', { config: 'multiwan', section: 'notify', values: { enabled: '0', throttle: '300' } }],
      ['uci', 'delete', { config: 'multiwan', section: 'notify', option: 'recipient' }],
    ])
  })
  it('sends nothing but the delete when the empty list is all there is', async () => {
    await set('network', 'lan', { dns: [] })
    expect(calls).toEqual([['uci', 'delete', { config: 'network', section: 'lan', option: 'dns' }]])
  })
})
