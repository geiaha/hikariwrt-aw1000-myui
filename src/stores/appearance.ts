// Appearance: seed colour, scheme variant, contrast, light/dark.
//
// Two copies, each for its own reason:
//  - localStorage, for the first paint: it's there before sign-in (the login
//    page is themed too) and before any router call returns.
//  - the router (/etc/config/hikariui, section "appearance"; see
//    composables/appearanceSync), so the choice survives what localStorage
//    doesn't: another browser or device, the router's address changing (the
//    storage is per address), or a browser that clears site data on exit.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SEED, VARIANTS, type SchemeVariant } from '@/theme/material'
import { load, save } from '@/utils/storage'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Appearance {
  seed: string
  variant: SchemeVariant
  contrast: number
  mode: ThemeMode
}

const KEY = 'hikari.appearance'
const DEFAULTS: Appearance = { seed: DEFAULT_SEED, variant: 'tonal-spot', contrast: 0, mode: 'system' }

/**
 * The fields of `v` that make sense, each checked on its own: a value from
 * localStorage or the router may be hand-edited, stale or from an older
 * build, and one bad field shouldn't throw the rest away.
 */
export function sanitize(v: Partial<Record<keyof Appearance, unknown>>): Partial<Appearance> {
  const out: Partial<Appearance> = {}
  if (typeof v.seed === 'string' && /^#[0-9a-f]{6}$/i.test(v.seed)) out.seed = v.seed
  if (typeof v.variant === 'string' && VARIANTS.some((x) => x.value === v.variant)) out.variant = v.variant as SchemeVariant
  const c = typeof v.contrast === 'string' ? Number(v.contrast) : v.contrast
  if (typeof c === 'number' && Number.isFinite(c) && c >= -1 && c <= 1) out.contrast = c
  if (v.mode === 'system' || v.mode === 'light' || v.mode === 'dark') out.mode = v.mode
  return out
}

export const useAppearance = defineStore('appearance', () => {
  const saved = { ...DEFAULTS, ...sanitize(load<Partial<Appearance>>(KEY, {})) }
  const seed = ref(saved.seed)
  const variant = ref<SchemeVariant>(saved.variant)
  const contrast = ref(saved.contrast)
  const mode = ref<ThemeMode>(saved.mode)

  function current(): Appearance {
    return { seed: seed.value, variant: variant.value, contrast: contrast.value, mode: mode.value }
  }

  /** Take on a saved appearance (the router's), keeping any field it lacks. */
  function apply(v: Partial<Appearance>): void {
    if (v.seed) seed.value = v.seed
    if (v.variant) variant.value = v.variant
    if (v.contrast != null) contrast.value = v.contrast
    if (v.mode) mode.value = v.mode
  }

  watch([seed, variant, contrast, mode], () => save(KEY, current()))

  return { seed, variant, contrast, mode, current, apply }
})
