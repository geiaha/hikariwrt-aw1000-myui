// Material You: the whole palette is generated from one seed colour with
// Google's material-color-utilities (the same library Android uses for
// wallpaper-based dynamic colour), then mapped onto Vuetify theme colours.
//
// Vuetify names and M3 names mostly agree, with one trap: Vuetify uses
// `surface-variant` / `on-surface-variant` as its *inverse* pair (tooltips,
// snackbars, flat chips). M3 draws those with inverse-surface, so that is
// what goes there. M3's real on-surface-variant (medium-emphasis text and
// icons) is exposed as `on-surface-muted` instead. See docs/DESIGN.md.

import {
  argbFromHex,
  customColor,
  DynamicScheme,
  hexFromArgb,
  Hct,
  MaterialDynamicColors as C,
  SchemeExpressive,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeTonalSpot,
  SchemeVibrant,
} from '@material/material-color-utilities'
import type { ThemeDefinition } from 'vuetify'

/** Hikari = light: amber is the brand seed. */
export const DEFAULT_SEED = '#E8A317'

// The four palettes of the design (canvas "Material You exploration").
// Tonal spot keeps only the seed's hue for the accents, so these seeds
// reproduce the drawn primary / primary-container / surface-container tones
// exactly; swatches show the generated primary, not the seed.
export const SEED_PRESETS = [
  { name: 'Amber', hex: '#E8A317' },
  { name: 'Teal', hex: '#A4BEB7' },
  { name: 'Indigo', hex: '#9B9CB3' },
  { name: 'Sakura', hex: '#80636C' },
] as const

export type SchemeVariant = 'tonal-spot' | 'vibrant' | 'expressive' | 'neutral' | 'monochrome'

export const VARIANTS: { value: SchemeVariant; title: string }[] = [
  { value: 'tonal-spot', title: 'Tonal (default)' },
  { value: 'vibrant', title: 'Vibrant' },
  { value: 'expressive', title: 'Expressive' },
  { value: 'neutral', title: 'Neutral' },
  { value: 'monochrome', title: 'Monochrome' },
]

export interface ThemeParams {
  seed: string
  variant: SchemeVariant
  /** M3 contrast level: 0 standard, 0.5 medium, 1 high. */
  contrast: number
}

function makeScheme(p: ThemeParams, dark: boolean): DynamicScheme {
  const hct = Hct.fromInt(argbFromHex(p.seed))
  switch (p.variant) {
    case 'vibrant':
      return new SchemeVibrant(hct, dark, p.contrast)
    case 'expressive':
      return new SchemeExpressive(hct, dark, p.contrast)
    case 'neutral':
      return new SchemeNeutral(hct, dark, p.contrast)
    case 'monochrome':
      return new SchemeMonochrome(hct, dark, p.contrast)
    default:
      return new SchemeTonalSpot(hct, dark, p.contrast)
  }
}

// Vuetify colour name -> M3 dynamic colour.
const ROLES = {
  background: C.background,
  'on-background': C.onBackground,
  surface: C.surface,
  'on-surface': C.onSurface,
  'surface-dim': C.surfaceDim,
  'surface-bright': C.surfaceBright,
  'surface-container-lowest': C.surfaceContainerLowest,
  'surface-container-low': C.surfaceContainerLow,
  'surface-container': C.surfaceContainer,
  'surface-container-high': C.surfaceContainerHigh,
  'surface-container-highest': C.surfaceContainerHighest,
  // Vuetify's alert/autocomplete "light surface".
  'surface-light': C.surfaceContainerHigh,
  // Vuetify's inverse pair (see header).
  'surface-variant': C.inverseSurface,
  'on-surface-variant': C.inverseOnSurface,
  'on-surface-muted': C.onSurfaceVariant,
  'inverse-primary': C.inversePrimary,
  outline: C.outline,
  'outline-variant': C.outlineVariant,
  scrim: C.scrim,
  shadow: C.shadow,
  primary: C.primary,
  'on-primary': C.onPrimary,
  'primary-container': C.primaryContainer,
  'on-primary-container': C.onPrimaryContainer,
  secondary: C.secondary,
  'on-secondary': C.onSecondary,
  'secondary-container': C.secondaryContainer,
  'on-secondary-container': C.onSecondaryContainer,
  tertiary: C.tertiary,
  'on-tertiary': C.onTertiary,
  'tertiary-container': C.tertiaryContainer,
  'on-tertiary-container': C.onTertiaryContainer,
  error: C.error,
  'on-error': C.onError,
  'error-container': C.errorContainer,
  'on-error-container': C.onErrorContainer,
}

// M3 has no success/warning/info roles. These are M3 "custom colours":
// fixed hues harmonised toward the seed so they sit in the palette instead
// of clashing with it, each with a container pair like the core roles.
const STATUS = { success: '#2E8B57', warning: '#E07A10', info: '#3A7BD5' }

export function buildTheme(p: ThemeParams, dark: boolean): ThemeDefinition {
  const scheme = makeScheme(p, dark)
  const colors: Record<string, string> = {}
  for (const [name, role] of Object.entries(ROLES)) {
    colors[name] = hexFromArgb(role.getArgb(scheme))
  }

  const source = argbFromHex(p.seed)
  for (const [name, hex] of Object.entries(STATUS)) {
    const g = customColor(source, { name, value: argbFromHex(hex), blend: true })
    const t = dark ? g.dark : g.light
    colors[name] = hexFromArgb(t.color)
    colors[`on-${name}`] = hexFromArgb(t.onColor)
    colors[`${name}-container`] = hexFromArgb(t.colorContainer)
    colors[`on-${name}-container`] = hexFromArgb(t.onColorContainer)
  }

  return {
    dark,
    colors,
    variables: {
      // Dividers and outlined cards are outline-variant in M3; Vuetify
      // draws them as border-color at border-opacity.
      'border-color': colors['outline-variant']!,
      'border-opacity': 1,
      'shadow-color': colors.shadow!,
      'theme-code': colors['surface-container-high']!,
      'theme-on-code': colors['on-surface']!,
      'theme-kbd': colors['surface-container-highest']!,
      'theme-on-kbd': colors['on-surface']!,
    },
  }
}

export function buildThemes(p: ThemeParams): { light: ThemeDefinition; dark: ThemeDefinition } {
  return { light: buildTheme(p, false), dark: buildTheme(p, true) }
}
