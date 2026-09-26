// Wired WAN (uci network.wan) and multi-WAN (uci multiwan) settings.
// Both have procd reload triggers, so a commit applies them; netifd only
// restarts the interface whose config changed. A failed save reverts the
// session's staged changes so a later apply can't pick up half of it.

import * as uci from './uci'

export type WanProto = 'dhcp' | 'pppoe' | 'static'

export interface WanConfig {
  proto: WanProto | string
  username: string
  password: string
  ipaddr: string
  netmask: string
  gateway: string
  /** Custom DNS servers; empty = use the ones the ISP hands out. */
  dns: string[]
  mtu: string
  ipv6: boolean
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(/\s+/).filter(Boolean) : [])

export async function wanConfig(): Promise<WanConfig | null> {
  try {
    const s = await uci.getSection('network', 'wan')
    return {
      proto: String(s.proto ?? 'dhcp'),
      username: String(s.username ?? ''),
      password: String(s.password ?? ''),
      ipaddr: String(s.ipaddr ?? ''),
      netmask: String(s.netmask ?? '255.255.255.0'),
      gateway: String(s.gateway ?? ''),
      dns: s.peerdns === '0' || String(s.proto) === 'static' ? list(s.dns) : [],
      mtu: String(s.mtu ?? ''),
      ipv6: s.ipv6 !== '0',
    }
  } catch {
    return null
  }
}

async function staged<T>(configs: string[], fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    for (const c of configs) await uci.revert(c).catch(() => undefined)
    throw e
  }
}

const PROTO_OPTS: Record<string, string[]> = {
  pppoe: ['username', 'password'],
  static: ['ipaddr', 'netmask', 'gateway'],
  dhcp: [],
}

export async function saveWan(c: WanConfig): Promise<void> {
  await staged(['network'], async () => {
    const values: Record<string, string | string[]> = { proto: c.proto, ipv6: c.ipv6 ? 'auto' : '0' }
    if (c.proto === 'pppoe') Object.assign(values, { username: c.username, password: c.password })
    if (c.proto === 'static') Object.assign(values, { ipaddr: c.ipaddr, netmask: c.netmask, gateway: c.gateway })
    if (c.mtu) values.mtu = c.mtu
    if (c.dns.length) {
      values.dns = c.dns
      if (c.proto !== 'static') values.peerdns = '0'
    }
    await uci.set('network', 'wan', values)
    // Options that belong to the other protocols, and emptied fields.
    const drop = Object.entries(PROTO_OPTS)
      .filter(([p]) => p !== c.proto)
      .flatMap(([, o]) => o)
    if (!c.mtu) drop.push('mtu')
    if (!c.dns.length) drop.push('dns', 'peerdns')
    await uci.del('network', 'wan', drop)
    await uci.commit('network')
  })
}

// ---- multi-WAN ----

export interface MwIface {
  name: string
  label: string
  enabled: boolean
  metric: number
  weight: number
}

export interface MultiwanFull {
  enabled: boolean
  mode: 'failover' | 'balance'
  interval: number
  trackIp: string[]
  ifaces: MwIface[]
  notify: { enabled: boolean; recipients: string[]; throttle: number } | null
}

export async function multiwanFull(): Promise<MultiwanFull | null> {
  try {
    const v = await uci.getConfig('multiwan')
    const g = v.globals ?? ({} as uci.UciSection)
    const n = v.notify
    return {
      enabled: g.enabled !== '0',
      mode: g.mode === 'balance' ? 'balance' : 'failover',
      interval: Number(g.interval ?? 5),
      trackIp: list(g.track_ip),
      ifaces: Object.values(v)
        .filter((s) => s['.type'] === 'interface')
        .map((s) => ({
          name: s['.name'],
          label: String(s.label ?? s['.name']),
          enabled: s.enabled !== '0',
          metric: Number(s.metric ?? 10),
          weight: Number(s.weight ?? 1),
        }))
        .sort((a, b) => a.metric - b.metric),
      notify: n ? { enabled: n.enabled === '1', recipients: list(n.recipient), throttle: Number(n.throttle ?? 300) } : null,
    }
  } catch {
    return null
  }
}

/** Order becomes metrics 10, 20, 30… (lower = preferred), as multiwand reads them. */
export async function saveMultiwan(m: MultiwanFull): Promise<void> {
  await staged(['multiwan'], async () => {
    await uci.set('multiwan', 'globals', { enabled: m.enabled ? '1' : '0', mode: m.mode })
    for (const [i, f] of m.ifaces.entries()) {
      await uci.set('multiwan', f.name, { metric: String((i + 1) * 10), weight: String(f.weight), enabled: f.enabled ? '1' : '0' })
    }
    if (m.notify) {
      await uci.set('multiwan', 'notify', {
        enabled: m.notify.enabled ? '1' : '0',
        recipient: m.notify.recipients,
        throttle: String(m.notify.throttle),
      })
    }
    await uci.commit('multiwan')
  })
}
