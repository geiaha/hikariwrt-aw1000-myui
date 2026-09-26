import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { buildThemes, DEFAULT_SEED } from '@/theme/material'

// Themes are regenerated from the saved seed in App.vue as soon as the
// appearance store loads; this default only covers the first paint.
const initial = buildThemes({ seed: DEFAULT_SEED, variant: 'tonal-spot', contrast: 0 })

export default createVuetify({
  blueprint: md3,
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: {
    defaultTheme: 'system',
    themes: initial,
  },
  defaults: {
    // M3 cards on a surface background: tonal, no shadow, 12px corners.
    VCard: { variant: 'flat', color: 'surface-container-low', rounded: 'lg' },
    VSwitch: { color: 'primary', inset: true, hideDetails: 'auto' },
    VTextField: { variant: 'outlined' },
    VSelect: { variant: 'outlined' },
    VBtn: { rounded: 'pill' },
    VChip: { rounded: 'lg' },
  },
})
