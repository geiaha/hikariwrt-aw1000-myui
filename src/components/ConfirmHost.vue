<script setup lang="ts">
import { computed } from 'vue'
import { useConfirm } from '@/composables/confirm'

const { request, answer } = useConfirm()
const open = computed({ get: () => request.value !== null, set: (v) => !v && answer(false) })
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card v-if="request" color="surface-container-high" rounded="xl" class="pa-6">
      <h2 class="hk-h2 mb-3" style="font-size: 24px">{{ request.title }}</h2>
      <p class="text-body-medium text-muted" style="white-space: pre-line">{{ request.text }}</p>
      <div class="d-flex flex-wrap justify-end ga-2 mt-6">
        <v-btn v-if="request.link" :href="request.link.href" variant="text" class="mr-auto">{{ request.link.label }}</v-btn>
        <v-btn variant="text" @click="answer(false)">Cancel</v-btn>
        <v-btn v-if="request.alt" variant="outlined" color="primary" @click="answer('alt')">{{ request.alt }}</v-btn>
        <v-btn :color="request.destructive ? 'error' : 'primary'" variant="flat" @click="answer(true)">{{ request.confirm }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
