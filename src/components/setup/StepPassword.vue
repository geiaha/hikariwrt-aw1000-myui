<script setup lang="ts">
import SecretField from '@/components/m3/SecretField.vue'
import type { SetupState } from '@/composables/setup'
import { useSession } from '@/stores/session'

defineProps<{ s: SetupState }>()
const session = useSession()
</script>

<template>
  <v-alert v-if="session.noPassword" type="warning" variant="tonal" density="comfortable">
    This router has no password yet, so anyone on your network could change its settings.
  </v-alert>
  <p v-else class="text-muted" style="font-size: 14px; margin: 0">Leave both empty to keep the current password.</p>
  <SecretField v-model="s.draft.password.a" label="New password" :error-messages="s.draft.password.a || session.noPassword ? s.passwordErrors.value.a : null" />
  <SecretField v-model="s.draft.password.b" label="Type it again" :error-messages="s.draft.password.b ? s.passwordErrors.value.b : null" />
  <span class="hk-label">At least 8 characters. A short sentence is easier to remember than random letters.</span>
</template>
