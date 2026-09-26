import type { NetInterface } from '@/api/router'
import type { MultiwanStatus } from '@/api/services'

export type UplinkState = 'active' | 'standby' | 'down'

export interface Uplink {
  name: string
  label: string
  proto: string
  ipv4: string | null
  uptime: number | null
  state: UplinkState
}

// Interface names the AW1000 build uses for its two WANs.
const LABELS: Record<string, string> = {
  wan: 'Wired WAN',
  wan6: 'Wired WAN (IPv6)',
  wwan0: '5G cellular',
}

const PROTO: Record<string, string> = {
  pppoe: 'PPPoE',
  dhcp: 'DHCP',
  static: 'Static',
  quectel: 'Cellular',
  dhcpv6: 'DHCPv6',
}

export function uplinkLabel(name: string): string {
  return LABELS[name] ?? name
}

export function protoLabel(proto: string): string {
  return PROTO[proto] ?? proto
}

const isDefault = (r: { target: string; mask: number }) => r.mask === 0 && (r.target === '0.0.0.0' || r.target === '::')

/**
 * WAN-side interfaces and which one carries traffic. An uplink is any
 * interface that installs a default route (or a known WAN name that is
 * down); the up one with the lowest metric is the one in use, since that's
 * the route the kernel picks, and the rest are on standby for failover.
 */
export function uplinks(ifaces: NetInterface[]): Uplink[] {
  const wanish = ifaces.filter((i) => i.route?.some(isDefault) || (i.interface in LABELS && i.interface !== 'wan6'))
  const live = wanish.filter((i) => i.up && i.route?.some(isDefault))
  const best = live.reduce<NetInterface | null>((a, i) => (!a || (i.metric ?? 0) < (a.metric ?? 0) ? i : a), null)

  return wanish
    .map((i) => ({
      name: i.interface,
      label: uplinkLabel(i.interface),
      proto: protoLabel(i.proto),
      ipv4: i['ipv4-address']?.[0]?.address ?? null,
      uptime: i.up ? (i.uptime ?? null) : null,
      state: (i === best ? 'active' : live.includes(i) ? 'standby' : 'down') as UplinkState,
    }))
    .sort((a, b) => order(a.state) - order(b.state))
}

const order = (s: UplinkState) => ({ active: 0, standby: 1, down: 2 })[s]

export interface UplinkView {
  name: string
  label: string
  cellular: boolean
  state: UplinkState
  proto: string
  ipv4: string | null
  gateway: string | null
  uptime: number | null
  latency: number | null
}

/**
 * The uplinks as the pages show them: multi-WAN's view when multiwand runs
 * (it knows which link it chose and how each one's health checks go), else
 * what the kernel's default routes say.
 */
export function uplinkViews(ifaces: NetInterface[], mw: MultiwanStatus | null): UplinkView[] {
  const byName = new Map(ifaces.map((i) => [i.interface, i]))
  if (mw?.interfaces?.length) {
    return [...mw.interfaces]
      .sort((a, b) => a.metric - b.metric)
      .map((m) => {
        const i = byName.get(m.interface ?? m.name)
        return {
          name: m.name,
          label: uplinkLabel(m.name),
          cellular: i?.proto === 'quectel' || m.name.startsWith('wwan'),
          state: (m.active ? 'active' : m.status === 'online' ? 'standby' : 'down') as UplinkState,
          proto: protoLabel(i?.proto ?? ''),
          ipv4: m.ipaddr,
          gateway: m.gateway,
          uptime: i?.up ? (i.uptime ?? null) : null,
          latency: m.latency,
        }
      })
  }
  return uplinks(ifaces).map((u) => {
    const i = byName.get(u.name)
    return {
      ...u,
      cellular: i?.proto === 'quectel',
      gateway: i?.route?.find((r) => r.mask === 0)?.nexthop ?? null,
      latency: null,
    }
  })
}
