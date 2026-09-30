import { describe, expect, it } from 'vitest'
import { COUNTRIES, countryByIso, countryByMcc, guessCountry } from './countries'

describe('countries', () => {
  it('maps MCCs to ISO codes, including countries with several', () => {
    expect(countryByMcc('515')?.iso).toBe('PH')
    expect(countryByMcc('311')?.iso).toBe('US')
    expect(countryByMcc('405')?.iso).toBe('IN')
    expect(countryByMcc('999')).toBeNull()
  })
  it('has unique ISO codes and MCCs', () => {
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length)
    const mccs = COUNTRIES.flatMap((c) => c.mcc)
    expect(new Set(mccs).size).toBe(mccs.length)
  })
  it('looks up ISO codes case-insensitively', () => {
    expect(countryByIso('ph')?.name).toBe('Philippines')
  })
  it('guesses from the SIM first, then a real Wi-Fi country, then the browser', () => {
    expect(guessCountry({ mcc: '515', wifi: 'DE', locale: 'en-GB' })?.iso).toBe('PH')
    expect(guessCountry({ wifi: 'DE', locale: 'en-GB' })?.iso).toBe('DE')
    expect(guessCountry({ wifi: 'US', locale: 'en-PH' })?.iso).toBe('PH')
    expect(guessCountry({ wifi: 'US', locale: 'en' })?.iso).toBe('US')
    expect(guessCountry({})).toBeNull()
  })
})
