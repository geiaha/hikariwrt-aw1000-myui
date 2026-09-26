<script setup lang="ts">
import { computed } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import type { RouterStatus } from '@/api/modem'
import { luciUrl } from '@/nav'

// Router mode vs IP passthrough, from aw1000-modem. Switching restarts the
// WAN side and has its own confirm-or-revert-on-reboot flow, which lives on
// the LuCI Router mode page for now.
const props = defineProps<{ status: RouterStatus | null }>()
const bridged = computed(() => !!props.status && props.status.mode !== 'routing')
</script>

<template>
  <section class="hk-card" aria-label="Router mode" style="gap: 12px">
    <div class="d-flex align-center ga-2">
      <h2 class="hk-h2 flex-grow-1">Router mode</h2>
      <span v-if="status?.pending" class="hk-chip hk-chip--outline">Change pending</span>
    </div>
    <template v-if="status">
      <div class="d-flex align-center ga-3">
        <span class="hk-mode-icon"><HkIcon :name="bridged ? 'passthrough' : 'router'" :stroke="bridged ? 2 : 1.8" /></span>
        <div class="d-flex flex-column">
          <span class="font-weight-bold">{{ bridged ? 'IP passthrough' : 'Router' }}</span>
          <span class="hk-label">{{ bridged ? 'The device on the WAN port gets the 5G address directly' : 'This router keeps the 5G address and shares it with your devices' }}</span>
        </div>
      </div>
    </template>
    <p v-else class="text-muted">Not available on this router.</p>
    <a :href="luciUrl('admin/modem/router')" class="hk-link mt-auto">Change in LuCI <HkIcon name="advanced" :size="16" /></a>
  </section>
</template>

<style scoped>
.hk-mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
}
</style>
