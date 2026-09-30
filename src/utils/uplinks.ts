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

/**
 * The radio technology the modem is on, as the connection diagram shows it:
 * "5G" for NSA or SA, "LTE", or whatever else the modem reports ("No
 * service"). The band and the NSA/SA detail are on the cellular card.
 */
export function radioMode(modeLabel: string | null | undefined): string {
  const m = modeLabel ?? ''
  return m.startsWith('5G') ? '5G' : m
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
  /** A global IPv6 address of the link, if it has one. */
  ipv6: string | null
  /** The IP versions actually up on this link: "IPv4 + IPv6", "IPv4", "IPv6", or null when neither. */
  families: string | null
  gateway: string | null
  uptime: number | null
  latency: number | null
}

// ---- one link, both families ----
//
// IPv4 and IPv6 of one uplink are separate things to netifd and multi-WAN:
//   wired   wan (IPv4) and wan6 (DHCPv6), two netifd interfaces;
//   5G      wwan0 carries both on a dual-stack call; with two calls ("split")
//           the IPv6 one is a dynamic interface, wwan0_6;
//   multi-WAN watches each family as its own entry (wan + wan_v6,
//           wwan0 + wwan0_v6).
// The pages show one link per uplink, with the families that are up on it.

const RANK: Record<UplinkState, number> = { active: 0, standby: 1, down: 2 }

/** The netifd interfaces that may carry this link's IPv6. */
function v6Siblings(name: string): string[] {
  return name === 'wan' ? ['wan6'] : [`${name}_6`]
}

const globalV6 = (i: NetInterface | undefined) =>
  i?.up ? (i['ipv6-address']?.find((a) => !/^fe80:/i.test(a.address))?.address ?? (i['ipv6-prefix']?.length ? i['ipv6-prefix'][0]!.address : null)) : null

/** The link a multi-WAN entry belongs to: wan6 -> wan, wwan0_6 -> wwan0, wan_v6 -> wan. */
export function linkOf(m: { name: string; interface?: string }): string {
  const n = m.interface ?? m.name
  if (n === 'wan6') return 'wan'
  return n.replace(/(_v?6)$/, '')
}

/** What is actually up on a link, per family, from netifd. */
export function linkFamilies(ifaces: NetInterface[], name: string): { v4: string | null; v6: string | null; label: string | null } {
  const byName = new Map(ifaces.map((i) => [i.interface, i]))
  const main = byName.get(name)
  const v4 = main?.up ? (main['ipv4-address']?.[0]?.address ?? null) : null
  const v6 = globalV6(main) ?? v6Siblings(name).map((n) => globalV6(byName.get(n))).find((x) => x) ?? null
  return { v4, v6, label: v4 && v6 ? 'IPv4 + IPv6' : v4 ? 'IPv4' : v6 ? 'IPv6' : null }
}

/**
 * The uplinks as the pages show them: multi-WAN's view when multiwand runs
 * (it knows which link it chose and how each one's health checks go), else
 * what the kernel's default routes say.
 */
export function uplinkViews(ifaces: NetInterface[], mw: MultiwanStatus | null): UplinkView[] {
  const byName = new Map(ifaces.map((i) => [i.interface, i]))
  if (mw?.interfaces?.length) {
    // One view per link: its IPv4 entry leads (the one people recognise),
    // and the link counts as active if either family is carrying traffic.
    const groups = new Map<string, typeof mw.interfaces>()
    for (const m of mw.interfaces) {
      const k = linkOf(m)
      groups.set(k, [...(groups.get(k) ?? []), m])
    }
    return [...groups.entries()]
      .map(([link, ms]) => {
        const lead = ms.find((m) => m.family !== 'ipv6') ?? ms[0]!
        const state = ms
          .map((m) => (m.active ? 'active' : m.status === 'online' ? 'standby' : 'down') as UplinkState)
          .reduce((a, b) => (RANK[b] < RANK[a] ? b : a))
        const i = byName.get(link)
        const fam = linkFamilies(ifaces, link)
        const v6entry = ms.find((m) => m.family === 'ipv6')
        const view: UplinkView = {
          name: link,
          label: uplinkLabel(link),
          cellular: i?.proto === 'quectel' || link.startsWith('wwan'),
          state,
          proto: protoLabel(i?.proto ?? ''),
          ipv4: lead.family === 'ipv6' ? null : lead.ipaddr,
          ipv6: fam.v6 ?? v6entry?.ipaddr ?? null,
          families: fam.label,
          gateway: lead.gateway,
          uptime: i?.up ? (i.uptime ?? null) : null,
          latency: ms.find((m) => m.active)?.latency ?? lead.latency,
        }
        return [Math.min(...ms.map((m) => m.metric)), view] as const
      })
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v)
  }
  return uplinks(ifaces).map((u) => {
    const i = byName.get(u.name)
    const fam = linkFamilies(ifaces, u.name)
    return {
      ...u,
      cellular: i?.proto === 'quectel',
      ipv6: fam.v6,
      families: fam.label,
      gateway: i?.route?.find((r) => r.mask === 0)?.nexthop ?? null,
      latency: null,
    }
  })
}
