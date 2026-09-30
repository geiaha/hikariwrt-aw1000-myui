<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import SecretField from '@/components/m3/SecretField.vue'
import SegmentedButton from '@/components/m3/SegmentedButton.vue'
import type { SetupState } from '@/composables/setup'

// Wired WAN (the ISP's cable) and the 5G SIM. Only the essentials: DNS,
// MTU and IPv6 stay on the Internet page for later.
const props = defineProps<{ s: SetupState }>()
const e = computed(() => props.s.wanErrors.value)
const m = computed(() => props.s.orig.modem)
const carriers = computed(() => (props.s.orig.profile?.carriers ?? []).map((c) => ({ value: c.id, title: `${c.name} · ${c.apn}` })))
const operator = computed(() => m.value?.operator ?? '')
</script>

<template>
  <div class="hk-sec">
    <div class="d-flex align-center ga-3">
      <span class="hk-sec__icon"><HkIcon name="ethernet" /></span>
      <div class="d-flex flex-column flex-grow-1">
        <span class="hk-h2" style="font-size: 18px">Cable from your ISP</span>
        <span class="hk-label">The router’s WAN port</span>
      </div>
      <span v-if="s.carrier.value === true" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />Cable detected</span>
      <span v-else-if="s.carrier.value === false" class="hk-chip hk-chip--outline">No cable</span>
    </div>
    <SegmentedButton
      v-model="s.draft.wan.proto"
      label="Connection type"
      :options="[
        { value: 'dhcp', label: 'Automatic' },
        { value: 'pppoe', label: 'PPPoE' },
        { value: 'static', label: 'Static IP' },
      ]"
    />
    <p v-if="s.draft.wan.proto === 'dhcp'" class="hk-label" style="margin: 0">Right for most fibre boxes and cable modems. Not using the cable? Leave this as it is.</p>
    <template v-if="s.draft.wan.proto === 'pppoe'">
      <p class="hk-label" style="margin: 0">Your ISP gave you a username and password for this, often on a sticker or in the welcome letter.</p>
      <div class="hk-two">
        <v-text-field v-model="s.draft.wan.username" label="PPPoE username" autocomplete="off" hide-details="auto" :error-messages="e.username || undefined" />
        <SecretField v-model="s.draft.wan.password" label="PPPoE password" />
      </div>
    </template>
    <template v-if="s.draft.wan.proto === 'static'">
      <div class="hk-two">
        <v-text-field v-model="s.draft.wan.ipaddr" label="IP address" hide-details="auto" :error-messages="e.ipaddr || undefined" />
        <v-text-field v-model="s.draft.wan.netmask" label="Netmask" hide-details="auto" :error-messages="e.netmask || undefined" />
      </div>
      <div class="hk-two">
        <v-text-field v-model="s.draft.wan.gateway" label="Gateway" hide-details="auto" :error-messages="e.gateway || undefined" />
        <v-text-field v-model="s.draft.wan.dns" label="DNS servers" placeholder="1.1.1.1, 9.9.9.9" persistent-placeholder hide-details="auto" :error-messages="e.dns || undefined" />
      </div>
    </template>
  </div>

  <div v-if="s.hasModem.value" class="hk-sec">
    <div class="d-flex align-center ga-3">
      <span class="hk-sec__icon"><HkIcon name="cellular" /></span>
      <div class="d-flex flex-column flex-grow-1">
        <span class="hk-h2" style="font-size: 18px">5G SIM</span>
        <span class="hk-label">
          <template v-if="m?.sim === 'ready'">{{ operator || 'SIM ready' }}<template v-if="m.mode_label"> · {{ m.mode_label }}</template></template>
          <template v-else>Used as a backup, or on its own</template>
        </span>
      </div>
      <span v-if="m?.sim === 'ready'" class="hk-chip hk-chip--tonal"><HkIcon name="check" :size="14" />SIM ready</span>
      <span v-else class="hk-chip hk-chip--outline">{{ m ? 'No SIM' : 'Checking…' }}</span>
    </div>
    <SegmentedButton
      v-model="s.draft.apn.mode"
      label="Access point (APN)"
      :options="[
        { value: 'auto', label: 'Automatic' },
        { value: 'list', label: 'Choose carrier' },
        { value: 'custom', label: 'Custom APN' },
      ]"
    />
    <p v-if="s.draft.apn.mode === 'auto'" class="hk-label" style="margin: 0">The SIM and network pick the APN. Works for most carriers.</p>
    <v-select
      v-else-if="s.draft.apn.mode === 'list'"
      v-model="s.draft.apn.carrier"
      :items="carriers"
      label="Your carrier"
      no-data-text="No carriers listed for this country"
      hide-details="auto"
      :error-messages="s.apnError.value || undefined"
    />
    <template v-else>
      <v-text-field v-model="s.draft.apn.apn" label="APN" autocomplete="off" hide-details="auto" :error-messages="s.draft.apn.apn ? s.apnError.value || undefined : undefined" />
      <div class="hk-two">
        <v-select v-model="s.draft.apn.auth" :items="[{ value: 'none', title: 'No login' }, { value: 'pap', title: 'PAP' }, { value: 'chap', title: 'CHAP' }]" label="Login" hide-details />
        <v-text-field v-if="s.draft.apn.auth !== 'none'" v-model="s.draft.apn.username" label="Username" hide-details />
      </div>
      <SecretField v-if="s.draft.apn.auth !== 'none'" v-model="s.draft.apn.password" label="Password" />
    </template>
  </div>
</template>

<style scoped>
.hk-sec {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-low));
}
.hk-sec__icon {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 599.98px) {
  .hk-two {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
