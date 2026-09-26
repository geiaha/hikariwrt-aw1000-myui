import { describe, expect, it } from 'vitest'
import { buildTheme, DEFAULT_SEED, SEED_PRESETS, VARIANTS } from './material'

const HEX = /^#[0-9a-f]{6}$/

describe('buildTheme', () => {
  it('produces every role as hex for light and dark', () => {
    for (const dark of [false, true]) {
      const t = buildTheme({ seed: DEFAULT_SEED, variant: 'tonal-spot', contrast: 0 }, dark)
      expect(t.dark).toBe(dark)
      for (const [k, v] of Object.entries(t.colors ?? {})) expect(v, k).toMatch(HEX)
      for (const [k, v] of Object.entries(t.variables ?? {})) expect(v, k).toBeDefined()
    }
  })

  it('maps Vuetify surface-variant to the M3 inverse surface', () => {
    const light = buildTheme({ seed: DEFAULT_SEED, variant: 'tonal-spot', contrast: 0 }, false)
    // Inverse surface is dark in the light theme: tooltips/snackbars.
    const v = parseInt(String(light.colors?.['surface-variant']).slice(1, 3), 16)
    expect(v).toBeLessThan(0x60)
  })

  it('works for every preset and variant', () => {
    for (const s of SEED_PRESETS)
      for (const v of VARIANTS)
        expect(buildTheme({ seed: s.hex, variant: v.value, contrast: 0.5 }, true).colors?.primary).toMatch(HEX)
  })
})

describe('design palettes', () => {
  // Values drawn on the design canvas (M3Dashboard.dc.html, PAL table).
  const drawn: Record<string, { light: string[]; dark: string[] }> = {
    Amber: { light: ['#7d570e', '#ffdeae', '#f8ecdf'], dark: ['#f1be6d', '#604100', '#241f17'] },
    Teal: { light: ['#016b5d', '#9ff2e0', '#e9efec'], dark: ['#83d5c5', '#005046', '#1b211f'] },
    Indigo: { light: ['#535a92', '#dfe0ff', '#efedf4'], dark: ['#bcc2ff', '#3b4279', '#1f1f25'] },
    Sakura: { light: ['#8b4a63', '#ffd9e3', '#faeaed'], dark: ['#ffb0cb', '#6f334b', '#261d20'] },
  }
  for (const p of SEED_PRESETS) {
    it(`${p.name} reproduces the drawn tones`, () => {
      for (const dark of [false, true]) {
        const c = buildTheme({ seed: p.hex, variant: 'tonal-spot', contrast: 0 }, dark).colors!
        expect([c.primary, c['primary-container'], c['surface-container']]).toEqual(drawn[p.name]![dark ? 'dark' : 'light'])
      }
    })
  }
})
