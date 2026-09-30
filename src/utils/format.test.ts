import { describe, expect, it } from 'vitest'
import { bytes, duration, load, percent, bitrate } from './format'

describe('bytes', () => {
  it('uses decimal units', () => {
    expect(bytes(999)).toBe('999 B')
    expect(bytes(1000)).toBe('1.0 kB')
    expect(bytes(63_900_000_000)).toBe('63.9 GB')
    expect(bytes(906_387_456)).toBe('906 MB')
  })
  it('handles missing values', () => {
    expect(bytes(null)).toBe('—')
    expect(bytes(Number.NaN)).toBe('—')
  })
})

describe('duration', () => {
  it('keeps the two largest units', () => {
    expect(duration(40)).toBe('40s')
    expect(duration(4748)).toBe('1h 19m')
    expect(duration(3 * 86400 + 4 * 3600 + 59)).toBe('3d 4h')
    expect(duration(86400)).toBe('1d')
  })
})

it('load converts fixed point', () => {
  expect(load(9952)).toBe('0.15')
})

it('percent clamps', () => {
  expect(percent(5, 0)).toBe(0)
  expect(percent(3, 2)).toBe(100)
  expect(percent(1, 3)).toBe(33)
})

it('durationLong reads as a sentence', async () => {
  const { durationLong, signed } = await import('./format')
  expect(durationLong(100800)).toBe('1 day 4 h')
  expect(durationLong(3 * 86400)).toBe('3 days')
  expect(durationLong(4 * 3600 + 720)).toBe('4 h 12 min')
  expect(durationLong(20)).toBe('1 min')
  expect(signed(-98)).toBe('−98')
  expect(signed(12)).toBe('12')
})

describe('bitrate', () => {
  it('reads in kbps, Mbps or Gbps', () => {
    expect(bitrate(512)).toBe('512 kbps')
    expect(bitrate(42000)).toBe('42 Mbps')
    expect(bitrate(12345)).toBe('12.3 Mbps')
    expect(bitrate(1500000)).toBe('1.5 Gbps')
  })
  it('moves up a unit when rounding reaches 1000', () => {
    expect(bitrate(999999)).toBe('1 Gbps')
    expect(bitrate(999.6)).toBe('1 Mbps')
  })
  it('shows a dash for nothing', () => {
    expect(bitrate(null)).toBe('—')
  })
})
