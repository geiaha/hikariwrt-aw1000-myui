// ubus over HTTP: uhttpd-mod-ubus exposes rpcd at /ubus as JSON-RPC 2.0.
//
// This is the only way the UI talks to the router. There is no LuCI
// dispatcher, no CGI of our own and no Lua/ucode on the request path: every
// screen is a set of ubus calls against objects that already exist
// (system, network.*, uci, luci-rpc, and the luci.aw1000-* rpcd plugins
// shipped by the hikariwrt feed). rpcd enforces the ACLs, so the UI never
// has to be trusted with anything the session isn't allowed to do.
//
// Calls made in the same tick are sent as one JSON-RPC batch, the same trick
// LuCI's rpc.js uses: a dashboard refresh that needs six objects costs one
// HTTP round trip instead of six, which matters on a busy router CPU.

export const NULL_SESSION = '00000000000000000000000000000000'

// Absolute: the app is served from /hikari/, but uhttpd mounts ubus at the
// server root.
const ENDPOINT = '/ubus'

// rpcd/ubus status codes (libubus UBUS_STATUS_*), index = code.
const STATUS_TEXT = [
  'OK',
  'Invalid command',
  'Invalid argument',
  'Method not found',
  'Not found',
  'No data',
  'Permission denied',
  'Timeout',
  'Not supported',
  'Unknown error',
  'Connection failed',
  'Out of memory',
  'Parse error',
  'System error',
]

// JSON-RPC level error uhttpd returns when the session id is unknown or has
// expired (rpcd drops idle sessions after their timeout).
const ACCESS_DENIED = -32002

export class UbusError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly object: string,
    readonly method: string,
  ) {
    super(message)
    this.name = 'UbusError'
  }

  /** The session is gone; the caller should send the user back to login. */
  get expired(): boolean {
    return this.code === ACCESS_DENIED
  }
}

interface Pending {
  id: number
  object: string
  method: string
  params: Record<string, unknown>
  sid: string
  resolve: (value: unknown) => void
  reject: (err: unknown) => void
}

interface RpcReply {
  id: number
  result?: [number, unknown?]
  error?: { code: number; message: string }
}

let session = NULL_SESSION
let nextId = 1
let queue: Pending[] = []
let expiredHandler: (() => void) | null = null

export function setSession(sid: string | null): void {
  session = sid || NULL_SESSION
}

export function getSession(): string {
  return session
}

/** Called once when any call reports the session as expired. */
export function onSessionExpired(fn: (() => void) | null): void {
  expiredHandler = fn
}

function flush(): void {
  const batch = queue
  queue = []
  if (!batch.length) return

  const body = batch.map((p) => ({
    jsonrpc: '2.0',
    id: p.id,
    method: 'call',
    params: [p.sid, p.object, p.method, p.params],
  }))

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.length === 1 ? body[0] : body),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const json = (await res.json()) as RpcReply | RpcReply[]
      const replies = new Map((Array.isArray(json) ? json : [json]).map((r) => [r.id, r]))
      let expired = false
      for (const p of batch) {
        const r = replies.get(p.id)
        const err = settle(p, r)
        if (err) {
          expired ||= err.expired && p.sid !== NULL_SESSION
          p.reject(err)
        }
      }
      if (expired) expiredHandler?.()
    })
    .catch((e: unknown) => {
      for (const p of batch) p.reject(e)
    })
}

// Resolves p on success, returns the error otherwise.
function settle(p: Pending, r: RpcReply | undefined): UbusError | null {
  if (!r) return new UbusError('No reply', -1, p.object, p.method)
  if (r.error) return new UbusError(r.error.message, r.error.code, p.object, p.method)
  const [code, data] = r.result ?? [9]
  if (code !== 0) {
    const text = STATUS_TEXT[code] ?? `Status ${code}`
    return new UbusError(`${p.object}.${p.method}: ${text}`, code, p.object, p.method)
  }
  // Methods that reply nothing (e.g. uci commit) resolve to an empty object
  // so callers can destructure without guarding.
  p.resolve(data ?? {})
  return null
}

/**
 * Call `object.method` with the current session. Rejects with UbusError on
 * any non-zero ubus status, so `await call(...)` either returns the reply or
 * throws; there is no third state to check.
 */
export function call<T = Record<string, unknown>>(
  object: string,
  method: string,
  params: Record<string, unknown> = {},
  opts: { sid?: string } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!queue.length) queueMicrotask(flush)
    queue.push({
      id: nextId++,
      object,
      method,
      params,
      sid: opts.sid ?? session,
      resolve: resolve as (v: unknown) => void,
      reject,
    })
  })
}

/**
 * Names of the ubus objects matching `pattern` (e.g. "luci.aw1000-*") that
 * the session may see. Not batched: it's a different JSON-RPC method and
 * only runs once per sign-in.
 */
export async function listObjects(pattern: string): Promise<string[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method: 'list', params: [session, pattern] }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { result?: Record<string, unknown>; error?: { code: number; message: string } }
  if (json.error) throw new UbusError(json.error.message, json.error.code, pattern, 'list')
  return Object.keys(json.result ?? {})
}

export interface LoginReply {
  ubus_rpc_session: string
  timeout: number
  expires: number
  acls: Record<string, Record<string, string[]>>
}

/**
 * rpcd login against /etc/config/rpcd `login` sections (root is there by
 * default, with the system password). `timeout` is the idle timeout: every
 * call made with the session pushes expiry forward again.
 */
export function login(username: string, password: string, timeout = 3600): Promise<LoginReply> {
  return call<LoginReply>('session', 'login', { username, password, timeout }, { sid: NULL_SESSION })
}
