import { expect, it } from 'vitest'
import type { NetInterface } from '@/api/router'
import { uplinks } from './uplinks'

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
