<script setup lang="ts">
import { computed } from 'vue'
import type { SetupState } from '@/composables/setup'

const props = defineProps<{ s: SetupState }>()
const zoneItems = computed(() => Object.keys(props.s.zones.value).sort())
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const hostOk = computed(() => /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(props.s.draft.system.hostname))
</script>

<template>
  <v-text-field
    v-model="s.draft.system.hostname"
    label="Router name"
    hint="How it shows up on your network, e.g. HikariWrt or Living-room"
    persistent-hint
    :error-messages="hostOk ? undefined : 'Letters, digits and dashes (no spaces)'"
  />
  <v-autocomplete v-model="s.draft.system.zonename" :items="zoneItems" label="Time zone" hide-details />
  <span v-if="s.draft.system.zonename === browserZone" class="hk-label">Matched to this device’s time zone.</span>
  <span class="hk-label">The clock itself is kept right automatically from internet time servers.</span>
</template>
