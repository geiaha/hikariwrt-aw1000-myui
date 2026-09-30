// Pure helpers for the cellular pages. No I/O, so they're unit tested.

import type { SmsPart } from '@/api/modem'

/** Map a reading onto 0..1 within a scale, clamped. */
export function scale(v: number | null | undefined, min: number, max: number): number {
  if (v == null || !Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, (v - min) / (max - min)))
}

// Display ranges for the metric bars: roughly "no service" to "as good as
// it gets" for each 3GPP measurement.
export const RANGES = {
  rsrp: [-140, -44],
  rsrq: [-20, -3],
  sinr: [-10, 30],
  temp: [0, 100],
} as const

/** "poor" -> "Poor signal". aw1000-modem grades: excellent/good/fair/poor. */
export function qualityHeadline(q: string | null | undefined): string {
  if (!q || q === 'unknown') return 'Signal unknown'
  return `${q[0]!.toUpperCase()}${q.slice(1)} signal`
}

// Centre frequency and duplex of the bands the RG500Q-EA supports, for the
// "n78 (3500 MHz TDD)" line. LTE uses the same numbering for the common ones.
const NR_BANDS: Record<number, string> = {
  1: '2100 MHz FDD', 3: '1800 MHz FDD', 5: '850 MHz FDD', 7: '2600 MHz FDD', 8: '900 MHz FDD',
  20: '800 MHz FDD', 28: '700 MHz FDD', 38: '2600 MHz TDD', 40: '2300 MHz TDD', 41: '2500 MHz TDD',
  77: '3700 MHz TDD', 78: '3500 MHz TDD', 79: '4700 MHz TDD',
}

export function bandDescription(band: string | null | undefined): string {
  if (!band) return ''
  const n = Number(band.replace(/^[a-zA-Z]+/, ''))
  const f = NR_BANDS[n]
  return f ? `${band} (${f})` : band
}

/**
 * gNB ID from a 36-bit NR cell identity (hex, as the modem prints it). The
 * split between gNB and cell is operator-chosen and not reported by the
 * modem; aw1000-modem's `gnb_id_bits` setting (24 by default) says where.
 */
export function gnbId(cellIdHex: string | null | undefined, bits = 24): number | null {
  if (!cellIdHex || !/^[0-9a-f]+$/i.test(cellIdHex)) return null
  const nci = BigInt(`0x${cellIdHex}`)
  return Number(nci >> BigInt(36 - bits))
}

/** "89636626100168989488" -> "8963 •••• •••• 9488" */
export function maskIccid(iccid: string | null | undefined): string {
  if (!iccid) return '—'
  if (iccid.length < 8) return iccid
  return `${iccid.slice(0, 4)} •••• •••• ${iccid.slice(-4)}`
}

/** Firmware revision without the model prefix: "RG500QEAAAR13A01M4G" -> "R13A01M4G". */
export function shortRevision(rev: string | null | undefined): string {
  if (!rev) return ''
  const m = rev.match(/R\d+A\d+M\w*$/)
  return m ? m[0] : rev
}

export interface SmsThread {
  sender: string
  timestamp: string
  text: string
  /** "STORE:index" of every part, for smsdelete. */
  specs: string[]
}

/**
 * Join concatenated SMS parts (same sender and reference) back into single
 * messages, newest first. The modem stores each 153-character part as its
 * own message, in no particular order.
 */
export function joinSms(parts: (SmsPart & { store?: string })[]): SmsThread[] {
  const groups = new Map<string, (SmsPart & { store?: string })[]>()
  for (const p of parts) {
    const key = p.total && p.total > 1 ? `${p.sender}|${p.reference}|${p.timestamp.slice(0, 13)}` : `single|${p.index}`
    const g = groups.get(key)
    if (g) g.push(p)
    else groups.set(key, [p])
  }
  return [...groups.values()]
    .map((g) => {
      g.sort((a, b) => (a.part ?? 0) - (b.part ?? 0))
      return {
        sender: g[0]!.sender,
        timestamp: g[0]!.timestamp,
        text: g.map((p) => p.content).join(''),
        specs: g.filter((p) => p.store).map((p) => `${p.store}:${p.index}`),
      }
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/** 5-bar signal meter from aw1000-modem's 0..100 percent. */
export function bars5(percent: number | null | undefined): number {
  if (percent == null) return 0
  return Math.min(5, Math.max(0, Math.ceil(percent / 20)))
}

// GSM 03.38 default alphabet, and the extension table (2 septets each).
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXT = '^{}\\[~]|€\f'

export interface SmsLength {
  encoding: 'GSM-7' | 'UCS-2'
  used: number
  max: number
  fits: boolean
}

/**
 * How much of one SMS a text uses, as the modem will encode it: 160 GSM-7
 * septets (extension characters count double), or 70 UTF-16 units once any
 * character falls outside GSM-7. aw1000-modem sends single messages only.
 */
export function smsLength(text: string): SmsLength {
  let septets = 0
  for (const ch of text) {
    if (GSM7.includes(ch)) septets += 1
    else if (GSM7_EXT.includes(ch)) septets += 2
    else {
      const used = text.length // UTF-16 code units
      return { encoding: 'UCS-2', used, max: 70, fits: used <= 70 }
    }
  }
  return { encoding: 'GSM-7', used: septets, max: 160, fits: septets <= 160 }
}

/** The PLMN the modem is registered on ("51502"), or null before it knows. */
export function homePlmn(mcc: string | null | undefined, mnc: string | null | undefined): string | null {
  return mcc && mnc ? `${mcc}${mnc}` : null
}

/**
 * A cell on another operator's network. A scan hears every operator in
 * range, and most of those cells are no use to lock to. A cell without a
 * PLMN is never foreign: neighbour lines and aggregated carriers carry none,
 * and both belong to the network the modem is already on. With no home PLMN
 * yet (not registered), nothing is foreign - there is nothing to compare to.
 */
export function isForeignCell(cell: { plmn: string | null }, home: string | null): boolean {
  return !!(home && cell.plmn && String(cell.plmn) !== home)
}

/** "51566" -> "515-66", how a PLMN is written everywhere else. */
export function plmnLabel(plmn: string): string {
  return plmn.length >= 5 ? `${plmn.slice(0, 3)}-${plmn.slice(3)}` : plmn
}
