// Per-browser appearance: seed colour, scheme variant, contrast, light/dark.
// Kept in localStorage on purpose: it's a viewer preference, not router
// config, so two people can look at the same router in different colours.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SEED, type SchemeVariant } from '@/theme/material'
import { load, save } from '@/utils/storage'

export type ThemeMode = 'system' | 'light' | 'dark'

interface Saved {
  seed: string
  variant: SchemeVariant
  contrast: number
  mode: ThemeMode
}

const KEY = 'hikari.appearance'

export const useAppearance = defineStore('appearance', () => {
  const saved = load<Saved>(KEY, { seed: DEFAULT_SEED, variant: 'tonal-spot', contrast: 0, mode: 'system' })
  const seed = ref(saved.seed)
  const variant = ref<SchemeVariant>(saved.variant)
  const contrast = ref(saved.contrast)
  const mode = ref<ThemeMode>(saved.mode)

  watch([seed, variant, contrast, mode], () =>
    save(KEY, { seed: seed.value, variant: variant.value, contrast: contrast.value, mode: mode.value }),
  )

  return { seed, variant, contrast, mode }
})
