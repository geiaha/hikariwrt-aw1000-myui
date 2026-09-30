import { describe, expect, it } from 'vitest'
import { bandDescription, bars5, gnbId, homePlmn, isForeignCell, joinSms, maskIccid, plmnLabel, qualityHeadline, scale, shortRevision, smsLength } from './cellular'

it('scale clamps', () => {
  expect(scale(-98, -140, -44)).toBeCloseTo(0.4375)
  expect(scale(-150, -140, -44)).toBe(0)
  expect(scale(null, 0, 1)).toBe(0)
})

it('describes bands', () => {
  expect(bandDescription('n78')).toBe('n78 (3500 MHz TDD)')
  expect(bandDescription('B3')).toBe('B3 (1800 MHz FDD)')
  expect(bandDescription('n999')).toBe('n999')
})

it('derives the gNB ID from a hex NCI', () => {
  // Live router: cell 300282102 with the default 24-bit split.
  expect(gnbId('300282102', 24)).toBe(0x300282)
  expect(gnbId(null)).toBeNull()
})

it('masks ICCID and trims firmware', () => {
  expect(maskIccid('89636626100168989488')).toBe('8963 •••• •••• 9488')
  expect(shortRevision('RG500QEAAAR13A01M4G')).toBe('R13A01M4G')
})

it('headlines and bars', () => {
  expect(qualityHeadline('poor')).toBe('Poor signal')
  expect(bars5(37)).toBe(2)
  expect(bars5(100)).toBe(5)
})

describe('joinSms', () => {
  it('reassembles parts in order, newest thread first', () => {
    const t = '2026-09-26 04:45:43'
    const parts = [
      { index: 0, store: 'ME', sender: 'DITO', timestamp: t, reference: 7, part: 2, total: 2, content: 'world' },
      { index: 1, store: 'ME', sender: 'DITO', timestamp: t, reference: 7, part: 1, total: 2, content: 'hello ' },
      { index: 2, store: 'SM', sender: '+63', timestamp: '2026-09-27 09:14:00', content: 'newer' },
    ]
    expect(joinSms(parts)).toEqual([
      { sender: '+63', timestamp: '2026-09-27 09:14:00', text: 'newer', specs: ['SM:2'] },
      { sender: 'DITO', timestamp: t, text: 'hello world', specs: ['ME:1', 'ME:0'] },
    ])
  })
})

describe('smsLength', () => {
  it('counts GSM-7 septets, extension chars double', () => {
    expect(smsLength('hello')).toEqual({ encoding: 'GSM-7', used: 5, max: 160, fits: true })
    expect(smsLength('€5 [ok]').used).toBe(10)
    expect(smsLength('x'.repeat(161)).fits).toBe(false)
  })
  it('switches to UCS-2 for anything else', () => {
    expect(smsLength('Salamat 🙏')).toEqual({ encoding: 'UCS-2', used: 10, max: 70, fits: true })
    expect(smsLength('ñ'.repeat(10)).encoding).toBe('GSM-7')
  })
})

describe('operator of a cell', () => {
  it('builds the home PLMN only when both halves are known', () => {
    expect(homePlmn('515', '02')).toBe('51502')
    expect(homePlmn('515', undefined)).toBeNull()
  })
  it('flags only cells known to be on another network', () => {
    expect(isForeignCell({ plmn: '51566' }, '51502')).toBe(true)
    expect(isForeignCell({ plmn: '51502' }, '51502')).toBe(false)
    expect(isForeignCell({ plmn: null }, '51502')).toBe(false)
    expect(isForeignCell({ plmn: '51566' }, null)).toBe(false)
  })
  it('writes a PLMN as MCC-MNC', () => {
    expect(plmnLabel('51566')).toBe('515-66')
    expect(plmnLabel('310260')).toBe('310-260')
  })
})
