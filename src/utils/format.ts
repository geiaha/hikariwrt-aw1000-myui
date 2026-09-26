// Display formatting. Sizes are decimal (kB/MB/GB) everywhere, matching the
// storage manager and what drive labels and ISP plans print.

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB']

export function bytes(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  let i = 0
  let v = Math.abs(n)
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000
    i++
  }
  const s = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 100 ? 0 : digits)
  return `${n < 0 ? '-' : ''}${s} ${UNITS[i]}`
}

/** "3d 4h", "4h 12m", "12m", "40s". Two largest units only. */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return m ? `${h}h ${m}m` : `${h}h`
  if (m) return `${m}m`
  return `${s}s`
}

/** ubus load averages are fixed point (x 65536). */
export function load(v: number): string {
  return (v / 65536).toFixed(2)
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}

/** "1 day 4 h", "4 h 12 min", "12 min" for sentences like "Up 1 day 4 h". */
export function durationLong(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''}`
  if (h) return `${h} h${m ? ` ${m} min` : ''}`
  return `${Math.max(m, 1)} min`
}

/** Typographic minus for signal readings: -98 -> "−98". */
export function signed(n: number | null | undefined): string {
  if (n == null) return '—'
  return n < 0 ? `−${Math.abs(n)}` : String(n)
}
