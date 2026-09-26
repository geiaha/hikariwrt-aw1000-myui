<script setup lang="ts">
import { nextTick, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { atRun } from '@/api/modem'

// AT console: one command at a time through aw1000-modem-at, which takes
// the shared modem lock, so it queues behind SMS and status reads instead
// of garbling them. Nothing here runs on its own.

interface Entry {
  command: string
  lines: string[]
  error?: string
  at: Date
}

const QUICK = ['ATI', 'AT+CSQ', 'AT+QENG="servingcell"', 'AT+QCAINFO', 'AT+COPS?', 'AT+CPIN?', 'AT+QTEMP']

const command = ref('')
const log = ref<Entry[]>([])
const busy = ref(false)
const history: string[] = []
let cursor = -1
const out = ref<HTMLElement | null>(null)

async function send(cmd = command.value.trim()): Promise<void> {
  if (!cmd || busy.value) return
  busy.value = true
  history.unshift(cmd)
  cursor = -1
  command.value = ''
  try {
    const r = await atRun(cmd)
    // The first line echoes the command; the header already shows it.
    const lines = (r.lines ?? []).filter((l, i) => !(i === 0 && l.trim().toUpperCase() === cmd.toUpperCase()))
    log.value.push({ command: cmd, lines, error: r.ok ? undefined : r.error || 'The modem did not answer.', at: new Date() })
  } catch (e) {
    log.value.push({ command: cmd, lines: [], error: e instanceof Error ? e.message : String(e), at: new Date() })
  } finally {
    busy.value = false
    await nextTick()
    out.value?.scrollTo({ top: out.value.scrollHeight })
  }
}

function recall(step: number): void {
  if (!history.length) return
  cursor = Math.max(-1, Math.min(history.length - 1, cursor + step))
  command.value = cursor < 0 ? '' : history[cursor]!
}
</script>

<template>
  <section class="hk-card" aria-label="AT console">
    <div class="d-flex align-center flex-wrap ga-3">
      <div class="d-flex flex-column flex-grow-1">
        <h2 class="hk-h2">AT console</h2>
        <span class="text-muted" style="font-size: 13px">
          Commands go straight to the modem. Some change settings that survive a reboot, so only send what you know.
        </span>
      </div>
      <v-btn v-if="log.length" variant="text" color="primary" height="40" @click="log = []">Clear</v-btn>
    </div>

    <div class="d-flex flex-wrap ga-2" role="group" aria-label="Common commands">
      <button v-for="q in QUICK" :key="q" type="button" class="hk-qchip" :disabled="busy" @click="send(q)">{{ q }}</button>
    </div>

    <div ref="out" class="hk-term" role="log" aria-live="polite" aria-label="Modem replies">
      <p v-if="!log.length" class="text-muted">Replies appear here.</p>
      <div v-for="(e, i) in log" :key="i" class="hk-term__entry">
        <div class="hk-term__cmd"><span class="text-primary">›</span> {{ e.command }}</div>
        <pre v-if="e.lines.length">{{ e.lines.join('\n') }}</pre>
        <div v-if="e.error" class="text-error">{{ e.error }}</div>
      </div>
      <div v-if="busy" class="text-muted">Waiting for the modem…</div>
    </div>

    <form class="d-flex align-center ga-2" @submit.prevent="send()">
      <v-text-field
        v-model="command"
        label="Command"
        placeholder='AT+QENG="servingcell"'
        hide-details
        autocomplete="off"
        spellcheck="false"
        class="hk-mono-field flex-grow-1"
        @keydown.up.prevent="recall(1)"
        @keydown.down.prevent="recall(-1)"
      />
      <v-btn type="submit" color="primary" variant="flat" height="56" min-width="104" :loading="busy" :disabled="!command.trim()">
        Send <HkIcon name="arrowRight" :size="18" class="ml-2" />
      </v-btn>
    </form>
  </section>
</template>

<style scoped>
.hk-qchip {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-on-surface-muted));
  font: 500 13px ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
}
.hk-qchip:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.hk-qchip:disabled {
  cursor: progress;
  opacity: 0.6;
}
.hk-term {
  background: rgb(var(--v-theme-surface-container-lowest));
  border-radius: 16px;
  padding: 14px 16px;
  min-height: 240px;
  max-height: 52vh;
  overflow-y: auto;
  font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.hk-term p {
  margin: 0;
  font-family: var(--v-font-body);
}
.hk-term__entry + .hk-term__entry {
  margin-top: 12px;
}
.hk-term__cmd {
  font-weight: 700;
}
.hk-term pre {
  margin: 2px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-mono-field :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
