import { describe, expect, it } from 'vitest'
import type { NetInterface } from '@/api/router'
import type { MultiwanIface, MultiwanStatus } from '@/api/services'
import { linkFamilies, linkOf, radioMode, uplinks, uplinkViews } from './uplinks'

const def = [{ target: '0.0.0.0', mask: 0, nexthop: '1.2.3.4' }]

// Mirrors the live router: PPPoE wan (metric 10) and quectel wwan0 (11).
const ifaces: NetInterface[] = [
  { interface: 'lan', proto: 'static', up: true, 'ipv4-address': [{ address: '192.168.88.1', mask: 24 }] },
  { interface: 'wwan0', proto: 'quectel', up: true, metric: 11, uptime: 60, route: def, 'ipv4-address': [{ address: '100.104.31.58', mask: 30 }] },
  { interface: 'wan', proto: 'pppoe', up: true, metric: 10, uptime: 90, route: def, 'ipv4-address': [{ address: '172.16.104.43', mask: 32 }] },
]

it('picks the lowest-metric live uplink as active', () => {
  const u = uplinks(ifaces)
  expect(u.map((x) => [x.name, x.state])).toEqual([
    ['wan', 'active'],
    ['wwan0', 'standby'],
  ])
  expect(u[0]!.label).toBe('Wired WAN')
  expect(u[0]!.proto).toBe('PPPoE')
})

it('fails over when wan is down', () => {
  const down = ifaces.map((i) => (i.interface === 'wan' ? { ...i, up: false, route: undefined } : i))
  expect(uplinks(down).map((x) => [x.name, x.state])).toEqual([
    ['wwan0', 'active'],
    ['wan', 'down'],
  ])
})

describe('one link per uplink, with its IP versions', () => {
  const v6 = [{ address: '2001:db8::5', mask: 128 }]
  const net: NetInterface[] = [
    { interface: 'wan', proto: 'pppoe', up: true, uptime: 90, 'ipv4-address': [{ address: '172.16.104.43', mask: 32 }] },
    { interface: 'wan6', proto: 'dhcpv6', up: true, 'ipv6-prefix': [{ address: '2001:db8:1::', mask: 56 }] },
    { interface: 'wwan0', proto: 'quectel', up: true, uptime: 60, 'ipv4-address': [{ address: '100.104.31.58', mask: 30 }], 'ipv6-address': v6 },
  ]
  const e = (name: string, family: string, active: boolean, extra: Partial<MultiwanIface> = {}): MultiwanIface => ({
    name, family, label: name, status: 'online', device: '', ipaddr: null, gateway: null, metric: name.startsWith('wan') ? 10 : 20, weight: 1, latency: 5, since: 0, active, ...extra,
  })
  const mw: MultiwanStatus = {
    mode: 'failover', enabled: 1, internet: true, updated: 0, active_ipv4: 'wan',
    interfaces: [
      e('wan', 'ipv4', true, { ipaddr: '172.16.104.43' }),
      e('wan_v6', 'ipv6', true, { interface: 'wan6' }),
      e('wwan0', 'ipv4', false),
      e('wwan0_v6', 'ipv6', false, { interface: 'wwan0' }),
    ],
  }

  it('merges multi-WAN\'s per-family entries into one link each', () => {
    const v = uplinkViews(net, mw)
    expect(v.map((x) => [x.name, x.state, x.families])).toEqual([
      ['wan', 'active', 'IPv4 + IPv6'],
      ['wwan0', 'standby', 'IPv4 + IPv6'],
    ])
    expect(v[1]!.ipv6).toBe('2001:db8::5')
  })

  it('shows only the families that are really up', () => {
    const v4only = net.map((i) => (i.interface === 'wwan0' ? { ...i, 'ipv6-address': [{ address: 'fe80::1', mask: 64 }] } : i))
    expect(uplinkViews(v4only, mw).find((x) => x.name === 'wwan0')!.families).toBe('IPv4')
  })

  it('finds IPv6 on the split-call interface (wwan0_6)', () => {
    const split = [...net.map((i) => (i.interface === 'wwan0' ? { ...i, 'ipv6-address': [] } : i)), { interface: 'wwan0_6', proto: 'dhcpv6', up: true, 'ipv6-address': v6 }]
    expect(linkFamilies(split, 'wwan0').label).toBe('IPv4 + IPv6')
    expect(linkOf({ name: 'wwan0_6' })).toBe('wwan0')
  })

  it('works without multi-WAN too', () => {
    const def = [{ target: '0.0.0.0', mask: 0, nexthop: '1.2.3.4' }]
    const v = uplinkViews(net.map((i) => (i.interface === 'wan' ? { ...i, route: def, metric: 10 } : i)), null)
    expect(v.find((x) => x.name === 'wan')!.families).toBe('IPv4 + IPv6')
  })
})

it('shows the radio mode as 5G or LTE, not the band', () => {
  expect(radioMode('5G-NSA')).toBe('5G')
  expect(radioMode('5G-SA')).toBe('5G')
  expect(radioMode('LTE')).toBe('LTE')
  expect(radioMode('No service')).toBe('No service')
  expect(radioMode(undefined)).toBe('')
})
