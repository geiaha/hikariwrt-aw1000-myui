<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import GlobalSearch from './GlobalSearch.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { useSession } from '@/stores/session'

// The design's page header: small overline, big title, page actions, then
// search and log out. On phones search and log out live in the top app bar,
// so only the titles (and actions) show here.
defineProps<{ overline?: string; title: string; hideOnPhone?: boolean }>()

const { xs, lgAndUp } = useDisplay()
const session = useSession()
const router = useRouter()

async function signOut(): Promise<void> {
  await session.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <header v-if="!(xs && hideOnPhone)" class="hk-header" :class="{ 'is-phone': xs }">
    <div class="hk-header__titles">
      <span v-if="overline" class="hk-overline">{{ overline }}</span>
      <h1 class="hk-h1">{{ title }}</h1>
    </div>
    <div v-if="$slots.actions" class="hk-header__actions"><slot name="actions" /></div>
    <template v-if="!xs">
      <GlobalSearch v-if="lgAndUp || !$slots.actions" :width="lgAndUp ? '380px' : '280px'" />
      <v-btn
        icon
        variant="flat"
        color="tertiary-container"
        width="48"
        height="48"
        aria-label="Log out"
        title="Log out"
        @click="signOut"
      >
        <HkIcon name="logout" />
      </v-btn>
    </template>
  </header>
</template>

<style scoped>
.hk-header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
}
.hk-header__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-grow: 1;
  min-width: 0;
}
.hk-header__actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.hk-header.is-phone {
  flex-wrap: wrap;
  gap: 12px;
}
.hk-header.is-phone .hk-h1 {
  font-size: 28px;
}
</style>
