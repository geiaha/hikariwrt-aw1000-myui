// 802.11s mesh via luci.aw1000-mesh. Roles: off, gateway (the node with the
// internet, hands out join codes), satellite (joins with a code). The
// backend validates everything that silently breaks a mesh (open mesh,
// auto channel, width mismatch) and only it writes the wireless mesh
// section. The dumb-AP posture changes this router's own address and has a
// boot fuse; it stays in LuCI.

import { call } from './ubus'

export interface MeshPeer {
  mac: string
  signal: number | null
  signal_avg: number | null
  rx_bitrate: string | number | null
  tx_bitrate: string | number | null
  expected_throughput: string | number | null
  connected_time: number | null
  inactive_ms: number | null
  plink: string
}

export interface MeshStatus {
  ok: boolean
  config: {
    role: 'off' | 'gateway' | 'satellite' | string
    applied_role: string
    mesh_id: string
    has_key: boolean
    radio: string
    band: string
    channel: number | string
    htmode: string
    country: string
    network: string
    ifname: string
  }
  live: { present: boolean; operstate: string; peers_total: number; peers_estab: number; paths: number; connected_to_gate: number }
  offload?: { nss_offload: number; vif_offloaded: boolean; firmware: string; firmware_ok: boolean }
  dumbap?: { enabled: boolean; confirmed: boolean }
}

export interface MeshRadio {
  name: string
  band: string
  channel: number
  htmode: string
  country: string
  disabled: boolean
  mesh_capable: boolean
  ap_and_mesh: boolean
  hw_mesh_offload: boolean
  aps: { section: string; ssid: string }[]
}

export interface PreflightCheck {
  id: string
  state: 'pass' | 'warn' | 'fail' | string
  value: string | null
  detail: string | null
}

type Reply = { ok: boolean; error?: string; warning?: string }

export const status = () => call<MeshStatus>('luci.aw1000-mesh', 'status')
export const peers = () => call<{ ok: boolean; peers: MeshPeer[]; path_count: number; connected_to_gate: number }>('luci.aw1000-mesh', 'peers')
export const radios = () => call<{ ok: boolean; radios: MeshRadio[] }>('luci.aw1000-mesh', 'radios')
export const preflight = () => call<{ ok: boolean; checks: PreflightCheck[] }>('luci.aw1000-mesh', 'preflight')
export const genkey = () => call<{ ok: boolean; key: string }>('luci.aw1000-mesh', 'genkey')
/** Join code for satellites (gateway only): mesh id, key, band, channel, width. */
export const code = () => call<{ ok: boolean; code: string; mesh_id: string; error?: string }>('luci.aw1000-mesh', 'code')
export type JoinEffect =
  | { kind: 'channel_move'; radio: string; from: number; to: number; aps: { section: string; ssid: string }[] }
  | { kind: 'htmode_change'; from: string; to: string }
  | { kind: 'country_change'; from: string; to: string }
  | { kind: 'radio_enabled'; radio: string; aps: { section: string; ssid: string }[] }

export interface CodeCheck extends Reply {
  payload?: { mesh_id: string; band: string; channel: number; htmode: string | null; country: string | null }
  local?: { radio: string; band: string; channel: number; htmode: string | null }
  effects?: JoinEffect[]
}

/** What joining with this code would do on `radio`, without doing it. */
export const codecheck = (c: string, radio: string) => call<CodeCheck>('luci.aw1000-mesh', 'codecheck', { code: c, radio })
export const join = (c: string, radio: string) => call<Reply>('luci.aw1000-mesh', 'join', { code: c, radio })
/** Only the keys given are changed ("" for channel etc. means keep the radio's). */
export const set = (values: Partial<Record<'role' | 'mesh_id' | 'key' | 'radio' | 'channel' | 'htmode' | 'country', string>>) =>
  call<Reply>('luci.aw1000-mesh', 'set', values)
export const off = () => call<Reply>('luci.aw1000-mesh', 'off')
