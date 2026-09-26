import { afterEach, describe, expect, it, vi } from 'vitest'
import { call, onSessionExpired, setSession, UbusError } from './ubus'

// uhttpd answers -32002 both for a dead session and for a call the live
// session's ACL doesn't allow; only the first may sign the user out.
function mockRouter(sessionAlive: boolean) {
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const req = JSON.parse(init.body)
    const reqs = Array.isArray(req) ? req : [req]
    const replies = reqs.map((r: { id: number; params: [string, string, string] }) => {
      const [, object, method] = r.params
      if (object === 'session' && method === 'access')
        return sessionAlive ? { jsonrpc: '2.0', id: r.id, result: [0, {}] } : { jsonrpc: '2.0', id: r.id, error: { code: -32002, message: 'Access denied' } }
      if (object === 'system') return { jsonrpc: '2.0', id: r.id, result: [0, { hostname: 'x' }] }
      return { jsonrpc: '2.0', id: r.id, error: { code: -32002, message: 'Access denied' } }
    })
    return { ok: true, json: async () => (Array.isArray(req) ? replies : replies[0]) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Access denied handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    onSessionExpired(null)
  })

  it('treats an ACL refusal on a live session as "not allowed", not expiry', async () => {
    mockRouter(true)
    setSession('a'.repeat(32))
    const expired = vi.fn()
    onSessionExpired(expired)
    const [ok, denied] = await Promise.allSettled([call('system', 'board'), call('network.device', 'status')])
    expect(ok.status).toBe('fulfilled')
    expect(denied.status).toBe('rejected')
    const e = (denied as PromiseRejectedResult).reason as UbusError
    expect(e.expired).toBe(false)
    expect(e.message).toMatch(/doesn't allow network\.device\.status/)
    expect(expired).not.toHaveBeenCalled()
  })

  it('signs out when the session really is gone', async () => {
    mockRouter(false)
    setSession('b'.repeat(32))
    const expired = vi.fn()
    onSessionExpired(expired)
    const e = await call('network.device', 'status').catch((x: unknown) => x as UbusError)
    expect(e.expired).toBe(true)
    expect(expired).toHaveBeenCalledOnce()
  })
})
