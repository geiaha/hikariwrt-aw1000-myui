<script setup lang="ts">
import { computed } from 'vue'
import { useAppearance } from '@/stores/appearance'
import { buildTheme, SEED_PRESETS, VARIANTS } from '@/theme/material'

// Seed colour, style, theme and contrast. Swatches show each palette's
// generated primary (what the UI will actually look like), not the seed.
// `colorsOnly`: just the swatches and light/dark (the setup wizard's welcome).
defineProps<{ colorsOnly?: boolean }>()
const look = useAppearance()
const swatches = computed(() =>
  SEED_PRESETS.map((p) => ({ ...p, primary: buildTheme({ seed: p.hex, variant: look.variant, contrast: 0 }, false).colors!.primary as string })),
)
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div>
      <div class="hk-label mb-2">Colour</div>
      <div class="d-flex flex-wrap ga-2" role="radiogroup" aria-label="Colour">
        <button
          v-for="p in swatches"
          :key="p.hex"
          type="button"
          role="radio"
          class="hk-swatch"
          :aria-checked="look.seed.toLowerCase() === p.hex.toLowerCase()"
          :aria-label="p.name"
          :title="p.name"
          :style="{ background: p.primary }"
          @click="look.seed = p.hex"
        />
        <label class="hk-swatch hk-swatch--custom" title="Custom colour">
          <input v-model="look.seed" type="color" aria-label="Custom colour" />
        </label>
      </div>
    </div>
    <v-select v-if="!colorsOnly" v-model="look.variant" :items="VARIANTS" label="Style" density="comfortable" hide-details />
    <div>
      <div class="hk-label mb-2">Theme</div>
      <v-btn-toggle v-model="look.mode" mandatory divided variant="outlined" density="comfortable" class="w-100" rounded="pill">
        <v-btn value="system" class="flex-grow-1">Auto</v-btn>
        <v-btn value="light" class="flex-grow-1">Light</v-btn>
        <v-btn value="dark" class="flex-grow-1">Dark</v-btn>
      </v-btn-toggle>
    </div>
    <div v-if="!colorsOnly">
      <div class="hk-label mb-2">Contrast</div>
      <v-btn-toggle v-model="look.contrast" mandatory divided variant="outlined" density="comfortable" class="w-100" rounded="pill">
        <v-btn :value="0" class="flex-grow-1">Standard</v-btn>
        <v-btn :value="0.5" class="flex-grow-1">Medium</v-btn>
        <v-btn :value="1" class="flex-grow-1">High</v-btn>
      </v-btn-toggle>
    </div>
  </div>
</template>

<style scoped>
.hk-swatch {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid transparent;
  outline: 2px solid transparent;
  cursor: pointer;
  position: relative;
}
.hk-swatch[aria-checked='true'] {
  outline-color: rgb(var(--v-theme-on-surface));
  border-color: rgb(var(--v-theme-surface-container-low));
}
.hk-swatch--custom {
  background: conic-gradient(#e0664f, #e8a317, #4c8c3a, #0f7b6c, #3f6fd8, #7a5ac8, #c2477a, #e0664f);
  overflow: hidden;
}
.hk-swatch--custom input {
  opacity: 0;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
