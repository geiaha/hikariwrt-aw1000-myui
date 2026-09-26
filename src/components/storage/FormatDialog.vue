<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as storage from '@/api/storage'
import type { Disk, Fs } from '@/api/storage'
import { useAction } from '@/composables/action'
import { bytes } from '@/utils/format'

// Whole-drive format. The drive name must be typed to confirm (the backend
// checks it too), and the filesystem choice is explained in terms of what
// the drive is for rather than by acronym.
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ disk: Disk | null }>()
const emit = defineEmits<{ started: [] }>()
const { busy, run } = useAction()

const FS: { value: Fs; title: string; why: string }[] = [
  { value: 'ext4', title: 'ext4', why: 'Best for the router: router storage, file sharing, anything Linux. Windows and macOS can’t read it without extra software.' },
  { value: 'exfat', title: 'exFAT', why: 'For moving big files between Windows, macOS, TVs and the router. No 4 GB file limit.' },
  { value: 'vfat', title: 'FAT32', why: 'For cameras, car stereos and older TVs. Files can’t be bigger than 4 GB.' },
  { value: 'ntfs', title: 'NTFS', why: 'For a drive that mostly lives on a Windows PC.' },
  { value: 'f2fs', title: 'F2FS', why: 'Made for flash drives and SD cards; also works as router storage.' },
]
const fs = ref<Fs>('ext4')
const label = ref('')
const confirm = ref('')
watch(open, (v) => {
  if (v) {
    fs.value = 'ext4'
    label.value = ''
    confirm.value = ''
  }
})
const ok = computed(() => !!props.disk && confirm.value.trim() === props.disk.name)

async function start(): Promise<void> {
  const d = props.disk
  if (!d) return
  if (await run('format', () => storage.format(d.name, fs.value, label.value.trim(), confirm.value.trim()))) {
    open.value = false
    emit('started')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card v-if="disk" color="surface-container-high" rounded="xl">
      <div class="pa-6 pb-2">
        <h2 class="hk-h2" style="font-size: 24px">Format {{ disk.vendor }} {{ disk.model }}?</h2>
        <p class="text-muted mt-1" style="font-size: 14px">{{ bytes(disk.size) }} · everything on it is erased.</p>
      </div>
      <v-card-text class="d-flex flex-column ga-3 px-6">
        <v-radio-group v-model="fs" hide-details class="hk-fs">
          <label v-for="f in FS" :key="f.value" class="hk-fs__opt" :class="{ on: fs === f.value }">
            <v-radio :value="f.value" color="primary" />
            <span class="d-flex flex-column">
              <span class="font-weight-bold" style="font-size: 14px">{{ f.title }}</span>
              <span class="hk-label">{{ f.why }}</span>
            </span>
          </label>
        </v-radio-group>
        <v-text-field v-model="label" label="Drive name (optional)" placeholder="USB" persistent-placeholder hide-details maxlength="16" />
        <v-text-field v-model="confirm" :label="`Type ${disk.name} to confirm`" hide-details autocomplete="off" spellcheck="false" />
      </v-card-text>
      <div class="d-flex justify-end ga-2 pa-6 pt-2">
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn variant="flat" color="error" :disabled="!ok" :loading="busy.format" @click="start">Erase and format</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.hk-fs :deep(.v-selection-control-group) {
  gap: 6px;
}
.hk-fs__opt {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 12px 10px 4px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-lowest));
  cursor: pointer;
}
.hk-fs__opt.on {
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-fs__opt.on .hk-label {
  color: inherit;
}
.hk-fs__opt > span {
  padding-top: 10px;
}
</style>
