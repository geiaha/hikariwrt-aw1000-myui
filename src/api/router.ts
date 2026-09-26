// Typed wrappers for the read-only calls the shell and dashboard need.
// Types list only the fields the UI uses; rpcd sends more.

import { call } from './ubus'

export interface Board {
  hostname: string
  model: string
  kernel: string
  release: { distribution: string; version: string; revision: string; target: string; description?: string }
}

export interface SystemInfo {
  localtime: number
  uptime: number
  /** 1/5/15-minute load averages, fixed point: divide by 65536. */
  load: [number, number, number]
  memory: { total: number; free: number; available: number; buffered: number; cached: number }
  root: { total: number; used: number; avail: number }
}

export interface NetInterface {
  interface: string
  proto: string
  up: boolean
  uptime?: number
  l3_device?: string
  metric?: number
  'ipv4-address'?: { address: string; mask: number }[]
  'ipv6-address'?: { address: string; mask: number }[]
  route?: { target: string; mask: number; nexthop: string }[]
}

export interface Lease {
  hostname?: string
  macaddr: string
  ipaddr?: string
  expires: number
}

export interface WirelessRadio {
  up: boolean
  config: { band?: string; channel?: string | number; htmode?: string }
  interfaces: {
    ifname?: string
    section: string
    config: { mode: string; ssid?: string; mesh_id?: string; disabled?: boolean }
  }[]
}

export const board = () => call<Board>('system', 'board')
export const systemInfo = () => call<SystemInfo>('system', 'info')

export const interfaces = () =>
  call<{ interface: NetInterface[] }>('network.interface', 'dump').then((r) => r.interface)

export const leases = () =>
  call<{ dhcp_leases: Lease[] }>('luci-rpc', 'getDHCPLeases').then((r) => r.dhcp_leases ?? [])

export const wireless = () => call<Record<string, WirelessRadio>>('network.wireless', 'status')

