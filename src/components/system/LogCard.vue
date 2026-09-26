<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import M3Switch from '@/components/m3/M3Switch.vue'
import { readLog } from '@/api/system'

// The last 300 lines of the system log, newest at the bottom, with a text
// filter and an "only problems" switch. Loaded on open and on Refresh.
const lines = ref<string[] | null>(null)
const error = ref('')
const query = ref('')
const problems = ref(false)
const busy = ref(false)
const box = ref<HTMLElement | null>(null)

async function load(): Promise<void> {
  busy.value = true
  try {
    lines.value = await readLog(300)
    error.value = ''
    // Newest lines are at the bottom; start there.
    await nextTick()
    box.value?.scrollTo({ top: box.value.scrollHeight })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
onMounted(load)

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (lines.value ?? []).filter((l) => (!problems.value || /\.(err|crit|alert|emerg|warn)\b/.test(l)) && (!q || l.toLowerCase().includes(q)))
})
const cls = (l: string) => (/\.(err|crit|alert|emerg)\b/.test(l) ? 'err' : /\.warn\b/.test(l) ? 'warn' : '')
</script>

<template>
  <section class="hk-card" aria-label="System log" style="gap: 12px">
    <div class="d-flex align-center flex-wrap ga-3">
      <h2 class="hk-h2 flex-grow-1">System log</h2>
      <div class="d-flex align-center ga-2">
        <span style="font-size: 13px">Only problems</span>
        <M3Switch v-model="problems" label="Only warnings and errors" />
      </div>
      <v-btn variant="flat" color="secondary-container" height="40" :loading="busy" @click="load"><HkIcon name="refresh" :size="18" class="mr-2" />Refresh</v-btn>
    </div>
    <label class="hk-find">
      <HkIcon name="search" class="text-muted" :size="20" />
      <input v-model="query" type="search" placeholder="Filter, e.g. dnsmasq or wwan0" aria-label="Filter the log" />
    </label>
    <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
    <div ref="box" class="hk-log" role="log" aria-label="System log lines">
      <div v-for="(l, i) in shown" :key="i" :class="cls(l)">{{ l }}</div>
      <p v-if="lines && !shown.length" class="text-muted">Nothing matches.</p>
    </div>
  </section>
</template>

<style scoped>
.hk-find {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
  border-radius: 22px;
  background: rgb(var(--v-theme-surface-container-high));
}
.hk-find input {
  flex-grow: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: rgb(var(--v-theme-on-surface));
}
.hk-log {
  background: rgb(var(--v-theme-surface-container-lowest));
  border-radius: 16px;
  padding: 12px 14px;
  max-height: 460px;
  overflow: auto;
  font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.hk-log .warn {
  color: rgb(var(--v-theme-warning));
}
.hk-log .err {
  color: rgb(var(--v-theme-error));
}
.hk-log p {
  margin: 0;
  font-family: var(--v-font-body);
}
</style>
