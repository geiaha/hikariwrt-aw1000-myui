<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import MeshRoleCard from '@/components/mesh/MeshRoleCard.vue'
import * as mesh from '@/api/mesh'
import { usePoll } from '@/composables/poll'
import { duration, signed } from '@/utils/format'

// Mesh: status and peers polled every 10 s (cheap reads of iw and sysfs);
// radios and the health checks load once and after a change.
const BAND: Record<string, string> = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz' }
const live = usePoll(async () => {
  const [s, p] = await Promise.all([mesh.status(), mesh.peers().catch(() => null)])
  return { status: s, peers: p }
}, 10000)
const radios = ref<mesh.MeshRadio[]>([])
const checks = ref<mesh.PreflightCheck[] | null>(null)
const showChecks = ref(false)

async function loadStatic(): Promise<void> {
  const [r, c] = await Promise.all([mesh.radios().catch(() => null), mesh.preflight().catch(() => null)])
  radios.value = r?.radios ?? []
  checks.value = c?.checks ?? null
}
onMounted(loadStatic)
function changed(): void {
  setTimeout(() => {
    live.refresh()
    loadStatic()
  }, 3000)
}

const st = computed(() => live.data.value?.status ?? null)
const role = computed(() => st.value?.config.applied_role || st.value?.config.role || 'off')
const ROLE: Record<string, string> = { gateway: 'Main router', satellite: 'Satellite', off: 'Mesh is off' }
const peers = computed(() => (live.data.value?.peers?.peers ?? []).filter((p) => p.plink === 'ESTAB' || !p.plink))
const failing = computed(() => checks.value?.filter((c) => c.state === 'fail') ?? [])
// Warnings are notes (e.g. "shares its radio with an AP"), not faults.
const notes = computed(() => checks.value?.filter((c) => c.state !== 'pass' && c.state !== 'fail') ?? [])
const flagged = computed(() => [...failing.value, ...notes.value])
const offloaded = computed(() => !!st.value?.offload?.vif_offloaded)
const rate = (v: string | number | null) => (v == null || v === '' ? '—' : typeof v === 'number' ? `${v} Mbit/s` : v)
</script>

<template>
  <PageHeader overline="802.11s wireless backhaul" title="Mesh" />

  <v-alert v-if="live.error.value" type="error" variant="tonal" rounded="xl">
    {{ live.error.value instanceof Error ? live.error.value.message : live.error.value }}
  </v-alert>

  <section v-if="st" class="hk-mesh-hero" aria-label="Mesh status">
    <div class="d-flex flex-column ga-1" style="min-width: 0">
      <span style="font-size: 14px; font-weight: 600">{{ st.config.mesh_id || 'Mesh' }}</span>
      <span class="hk-display" style="font-size: 44px; letter-spacing: -0.5px">{{ ROLE[role] ?? role }}</span>
      <span v-if="role !== 'off'" style="font-size: 15px">
        {{ BAND[st.config.band] ?? st.config.band }} · channel {{ st.config.channel }} · {{ String(st.config.htmode).replace(/^\D+/, '') }} MHz
      </span>
    </div>
    <div v-if="role !== 'off'" class="hk-mesh-stats">
      <div class="hk-mesh-stat">
        <span class="hk-display" style="font-size: 32px">{{ st.live.peers_estab }}</span>
        <span>{{ st.live.peers_estab === 1 ? 'node linked' : 'nodes linked' }}</span>
      </div>
      <div class="hk-mesh-stat">
        <span class="hk-display" style="font-size: 20px; line-height: 1.6">{{ offloaded ? 'NSS' : 'Software' }}</span>
        <span>{{ offloaded ? 'hardware forwarding' : 'forwarding' }}</span>
      </div>
    </div>
  </section>
  <v-skeleton-loader v-else-if="!live.error.value" type="heading, text" class="hk-card" />

  <div class="hk-mesh-grid">
    <MeshRoleCard v-if="st" :status="st" :radios="radios" @changed="changed" />

    <div class="d-flex flex-column ga-4" style="min-width: 0">
      <section v-if="role !== 'off'" class="hk-card" aria-label="Linked nodes" style="gap: 10px">
        <h2 class="hk-h2">Linked nodes</h2>
        <div v-for="p in peers" :key="p.mac" class="hk-peer">
          <span class="hk-peer__icon"><HkIcon name="router" :stroke="1.8" /></span>
          <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
            <span class="font-weight-bold" style="font-size: 14px">{{ p.mac.toUpperCase() }}</span>
            <span class="hk-label">{{ signed(p.signal) }} dBm · ↓ {{ rate(p.rx_bitrate) }} · ↑ {{ rate(p.tx_bitrate) }}</span>
          </div>
          <span class="hk-label">{{ duration(p.connected_time) }}</span>
        </div>
        <p v-if="!peers.length" class="text-muted" style="font-size: 14px; margin: 0">
          {{ role === 'gateway' ? 'No satellites have joined yet.' : 'Not linked to the main router yet.' }}
        </p>
      </section>

      <section class="hk-card" aria-label="Health checks" style="gap: 10px">
        <div class="d-flex align-center ga-2">
          <h2 class="hk-h2 flex-grow-1">Health</h2>
          <span v-if="checks" class="hk-chip" :class="failing.length ? 'hk-chip--error' : notes.length ? 'hk-chip--outline' : 'hk-chip--tonal'">
            <HkIcon v-if="!failing.length && !notes.length" name="check" :size="14" />
            {{ failing.length ? `${failing.length} failing` : notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : 'All good' }}
          </span>
        </div>
        <p class="text-muted" style="font-size: 13px; margin: 0">Whether the hardware, firmware and radio can carry a fast mesh.</p>
        <template v-if="checks">
          <div v-for="c in showChecks ? checks : flagged" :key="c.id" class="hk-check">
            <span class="hk-dot" :class="c.state" />
            <span class="flex-grow-1" style="font-size: 13px">{{ c.id.replace(/_/g, ' ') }}</span>
            <span class="hk-label">{{ c.value ?? c.detail }}</span>
          </div>
          <button type="button" class="hk-link" @click="showChecks = !showChecks">{{ showChecks ? 'Hide details' : `Show all ${checks.length} checks` }}</button>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hk-mesh-hero {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  border-radius: var(--hk-r-hero);
  padding: 28px 36px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px 40px;
}
.hk-mesh-stats {
  display: flex;
  gap: 12px;
  margin-left: auto;
}
.hk-mesh-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 14px 20px;
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  min-width: 140px;
}
.hk-mesh-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 1279.98px) {
  .hk-mesh-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 599.98px) {
  .hk-mesh-hero {
    padding: 20px;
    border-radius: 28px;
  }
  .hk-mesh-stats {
    margin-left: 0;
    width: 100%;
  }
  .hk-mesh-stat {
    flex: 1;
    min-width: 0;
  }
}
.hk-peer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.hk-peer__icon {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
}
.hk-check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}
.hk-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgb(var(--v-theme-outline));
}
.hk-dot.pass {
  background: rgb(var(--v-theme-success));
}
.hk-dot.warn {
  background: rgb(var(--v-theme-warning));
}
.hk-dot.fail {
  background: rgb(var(--v-theme-error));
}
</style>
