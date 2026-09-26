<script setup lang="ts">
import { ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'

// Password-style field with a show/hide button. Stored secrets (PPPoE,
// Wi-Fi keys) are loaded masked; showing them is a deliberate tap.
defineProps<{ label: string; errorMessages?: string | null; hint?: string }>()
const model = defineModel<string>({ required: true })
const show = ref(false)
</script>

<template>
  <v-text-field
    v-model="model"
    :label="label"
    :type="show ? 'text' : 'password'"
    autocomplete="new-password"
    spellcheck="false"
    :error-messages="errorMessages || undefined"
    :hint="hint"
    :persistent-hint="!!hint"
    hide-details="auto"
  >
    <template #append-inner>
      <v-btn icon variant="text" size="small" :aria-label="show ? `Hide ${label}` : `Show ${label}`" @click="show = !show">
        <HkIcon :name="show ? 'eyeOff' : 'eye'" :size="20" />
      </v-btn>
    </template>
  </v-text-field>
</template>
