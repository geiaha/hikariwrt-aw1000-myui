<script setup lang="ts">
import { computed } from 'vue'
import type { SetupState } from '@/composables/setup'
import { COUNTRIES, countryByMcc } from '@/utils/countries'

const props = defineProps<{ s: SetupState }>()
const zoneItems = computed(() => Object.keys(props.s.zones.value).sort())
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const hostOk = computed(() => /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(props.s.draft.system.hostname))
const countryItems = COUNTRIES.map((c) => ({ value: c.iso, title: c.name }))
// Said when the choice matches where the SIM is registered, which is where
// the router actually is.
const fromSim = computed(() => countryByMcc(props.s.orig.modem?.mcc)?.iso === props.s.draft.system.country)
</script>

<template>
  <v-text-field
    v-model="s.draft.system.hostname"
    label="Router name"
    hint="How it shows up on your network, e.g. HikariWrt or Living-room"
    persistent-hint
    :error-messages="hostOk ? undefined : 'Letters, digits and dashes (no spaces)'"
  />
  <v-autocomplete
    v-model="s.draft.system.country"
    :items="countryItems"
    label="Country"
    hint="Sets which Wi-Fi channels and power are legal here, and which carriers the 5G setup lists"
    persistent-hint
    :error-messages="s.draft.system.country ? undefined : 'Choose the country the router is in'"
  />
  <span v-if="fromSim" class="hk-label">Matched to the network the SIM is on.</span>
  <v-autocomplete v-model="s.draft.system.zonename" :items="zoneItems" label="Time zone" hide-details />
  <span v-if="s.draft.system.zonename === browserZone" class="hk-label">Matched to this device’s time zone.</span>
  <span class="hk-label">The clock itself is kept right automatically from internet time servers.</span>
</template>
