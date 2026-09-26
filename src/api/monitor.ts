// Internet uptime and quality via luci.aw1000-monitor (aw1000-monitor in the
// hikariwrt feed). The collector keeps the history; this only reads it.
// Settings (targets, thresholds, USB history) are changed on the LuCI page.

import { call } from './ubus'

export type Range = '1h' | '24h' | '7d' | '30d' | '90d' | '365d'

export interface MonitorWan {
  name: string
  label: string
  enabled: boolean
  targets: string[]
  last: {
    ts: number
    up: boolean
    link: boolean
    rtt: number | null
    loss: number | null
    rx_rate: number
    tx_rate: number
    device: string | null
  } | null
  /** Averages over the last five minutes, for a steady status chip. */
  recent?: { rtt: number | null; loss: number } | null
  outage: { start: number; cause: 'link' | 'noreply' } | null
  uptime: { '24h': number | null; '7d': number | null; '30d': number | null }
}

export interface MonitorStatus {
  ok: boolean
  running: boolean
  clock_ok: boolean
  now: number
  interval: number
  timeout: number
  degraded_loss: number
  degraded_rtt: number
  retain_days: number
  persist: { enabled: boolean; target: string | null; path: string | null; days: number; last_flush: number | null; error: string | null }
  storage: { id: string; label: string; path: string }[]
  wans: MonitorWan[]
}

/** Bucket state: 0 no data, 1 up, 2 degraded, 3 down. */
export type BucketState = 0 | 1 | 2 | 3

export interface WanSeries {
  name: string
  label: string
  ts: number[]
  state: BucketState[]
  rtt: (number | null)[]
  rmin: (number | null)[]
  rmax: (number | null)[]
  jitter: (number | null)[]
  loss: (number | null)[]
  /** Bytes per second over the bucket. */
  rx: (number | null)[]
  tx: (number | null)[]
  summary: { uptime: number | null; rtt: number | null; loss: number | null; jitter: number | null; rx: number; tx: number; down_seconds: number; samples: number }
}

export interface Series {
  ok: boolean
  range: Range
  from: number
  to: number
  step: number
  degraded_loss: number
  degraded_rtt: number
  wans: WanSeries[]
}

export interface Outage {
  wan: string
  label: string
  start: number
  end: number | null
  cause: 'link' | 'noreply'
  duration: number
}

export const status = () => call<MonitorStatus>('luci.aw1000-monitor', 'status')
export const series = (range: Range, wan = 'all') => call<Series>('luci.aw1000-monitor', 'series', { wan, range })
export const events = (range: Range) => call<{ ok: boolean; range: Range; events: Outage[] }>('luci.aw1000-monitor', 'events', { range })
