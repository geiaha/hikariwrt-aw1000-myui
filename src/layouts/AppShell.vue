<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import AppearanceSettings from '@/components/AppearanceSettings.vue'
import BrandMark from '@/components/BrandMark.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { luciUrl, NAV } from '@/nav'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'

// Layout per the design canvas:
//   >= 600px  navigation rail (104px): menu, speed-test FAB, destinations,
//             Advanced at the bottom. Pages draw their own header.
//   <  600px  top app bar (logo, search, log out), bottom navigation
//             (Home, Cellular, Clients, More) and an extended FAB on Home.
// The menu button (and "More") opens a modal drawer with every destination,
// Appearance and LuCI.
const { xs } = useDisplay()
const route = useRoute()
const router = useRouter()
const session = useSession()
const ui = useUi()

const nav = computed(() => NAV.filter((n) => !n.requires || session.has(n.requires)))
const primary = computed(() => nav.value.filter((n) => n.primary))
const inPrimary = computed(() => primary.value.some((n) => n.name === route.name))
const isActive = (name: string) => route.name === name

async function signOut(): Promise<void> {
  ui.drawer = false
  await session.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <!-- Navigation rail -->
  <v-navigation-drawer v-if="!xs" permanent width="104" color="surface" border="0">
    <nav class="hk-rail" aria-label="Main">
      <v-btn icon variant="text" width="48" height="48" aria-label="Open menu" class="text-muted" @click="ui.drawer = true">
        <HkIcon name="menu" :size="24" />
      </v-btn>
      <button type="button" class="hk-fab" aria-label="Run speed test" title="Speed test" @click="ui.openSpeedTest()">
        <HkIcon name="speed" :size="24" />
      </button>
      <router-link
        v-for="n in nav"
        :key="n.name"
        :to="n.path"
        class="hk-dest"
        :class="{ 'is-active': isActive(n.name) }"
        :aria-current="isActive(n.name) ? 'page' : undefined"
      >
        <span class="hk-dest__pill">
          <HkIcon :name="n.name === 'home' && isActive(n.name) ? 'homeFilled' : n.icon" :stroke="isActive(n.name) && n.icon === 'cellular' ? 2.6 : undefined" />
        </span>
        {{ n.title }}
      </router-link>
      <div class="flex-grow-1" />
      <a :href="luciUrl()" class="hk-dest">
        <span class="hk-dest__pill"><HkIcon name="advanced" /></span>
        Advanced
      </a>
    </nav>
  </v-navigation-drawer>

  <!-- Phone top app bar -->
  <v-app-bar v-if="xs" color="surface" height="64" flat>
    <div class="d-flex align-center ga-3 pl-4 flex-grow-1">
      <BrandMark :size="40" />
    </div>
    <v-btn icon variant="text" width="48" height="48" aria-label="Search settings" class="text-muted" @click="ui.search = true">
      <HkIcon name="search" />
    </v-btn>
    <v-btn icon variant="text" width="48" height="48" aria-label="Log out" class="text-muted mr-2" @click="signOut">
      <HkIcon name="logout" />
    </v-btn>
  </v-app-bar>

  <!-- Menu drawer (all sizes) -->
  <v-navigation-drawer v-model="ui.drawer" temporary width="340" color="surface-container-low" location="left" @keydown.esc="ui.drawer = false">
    <div class="px-6 pt-6 pb-2"><BrandMark /></div>
    <div class="hk-label px-6 pb-4">{{ session.board?.model }} · {{ session.board?.release.version }}</div>
    <v-list nav class="hk-menu px-3" bg-color="transparent">
      <v-list-item v-for="n in nav" :key="n.name" :to="n.path" :title="n.title" :exact="n.path === '/'" @click="ui.drawer = false">
        <template #prepend><HkIcon :name="n.icon" class="mr-4" /></template>
      </v-list-item>
      <v-list-item :href="luciUrl()" title="Advanced settings" subtitle="OpenWrt LuCI">
        <template #prepend><HkIcon name="advanced" class="mr-4" /></template>
      </v-list-item>
    </v-list>
    <v-divider class="mx-6 my-3" />
    <div class="px-6">
      <div class="hk-h2 mb-4" style="font-size: 16px">Appearance</div>
      <AppearanceSettings />
    </div>
    <v-divider class="mx-6 my-4" />
    <v-list nav class="hk-menu px-3 pb-4" bg-color="transparent">
      <v-list-item title="Log out" :subtitle="session.username" @click="signOut">
        <template #prepend><HkIcon name="logout" class="mr-4" /></template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>

  <v-main class="bg-surface">
    <div class="hk-page" :class="{ 'is-phone': xs }">
      <router-view />
    </div>
  </v-main>

  <!-- Phone: extended FAB on Home, bottom navigation -->
  <button v-if="xs && route.name === 'home'" type="button" class="hk-efab" @click="ui.openSpeedTest()">
    <HkIcon name="speed" />Speed test
  </button>
  <v-bottom-navigation v-if="xs" grow height="80" bg-color="surface-container" class="hk-bottom" elevation="0" :model-value="route.name">
    <v-btn v-for="n in primary" :key="n.name" :value="n.name" :to="n.path" :class="{ 'is-active': isActive(n.name) }">
      <span class="hk-dest__pill wide"><HkIcon :name="n.name === 'home' && isActive(n.name) ? 'homeFilled' : n.icon" /></span>
      <span class="hk-bottom__label">{{ n.title }}</span>
    </v-btn>
    <v-btn value="more" :class="{ 'is-active': !inPrimary }" @click="ui.drawer = true">
      <span class="hk-dest__pill wide"><HkIcon name="more" /></span>
      <span class="hk-bottom__label">More</span>
    </v-btn>
  </v-bottom-navigation>

  <!-- Phone search -->
  <v-dialog v-model="ui.search" fullscreen transition="dialog-bottom-transition">
    <v-card color="surface" class="pa-4">
      <div class="d-flex align-center ga-2">
        <v-btn icon variant="text" aria-label="Close search" @click="ui.search = false"><HkIcon name="close" /></v-btn>
        <GlobalSearch autofocus width="100%" @done="ui.search = false" />
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.hk-page {
  padding: 20px 32px 28px 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1440px;
}
.hk-page.is-phone {
  padding: 4px 16px 104px;
  gap: 12px;
}

.hk-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 0 24px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}
/* Short windows (a laptop browser is ~800px tall): tighten the rail so all
   destinations fit without a scrollbar. */
@media (max-height: 880px) {
  .hk-rail {
    gap: 4px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
  .hk-rail .hk-fab {
    margin-bottom: 8px;
  }
}
.hk-rail {
  scrollbar-width: none;
}
.hk-fab {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 16px;
  border: 0;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18), 0 4px 8px 2px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  cursor: pointer;
}
.hk-fab:hover {
  filter: brightness(0.96);
}
.hk-dest {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 80px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-on-surface-muted));
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
}
.hk-dest__pill {
  width: 56px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}
.hk-dest__pill.wide {
  width: 64px;
}
.hk-dest:hover .hk-dest__pill {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.hk-dest.is-active {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 700;
}
.hk-dest.is-active .hk-dest__pill,
.hk-bottom .is-active .hk-dest__pill {
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-dest:focus-visible,
.hk-fab:focus-visible {
  outline: 3px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
  border-radius: 16px;
}

.hk-menu :deep(.v-list-item) {
  border-radius: 999px;
  min-height: 56px;
}
.hk-menu :deep(.v-list-item--active) {
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.hk-menu :deep(.v-list-item--active > .v-list-item__overlay) {
  opacity: 0;
}

.hk-bottom {
  padding-top: 12px;
  align-items: flex-start;
}
.hk-bottom :deep(.v-btn) {
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-bottom :deep(.v-btn__content) {
  flex-direction: column;
  gap: 4px;
}
.hk-bottom :deep(.v-btn__overlay) {
  opacity: 0 !important;
}
.hk-bottom .is-active {
  color: rgb(var(--v-theme-on-surface)) !important;
}
.hk-bottom__label {
  font-size: 12px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}
.hk-bottom .is-active .hk-bottom__label {
  font-weight: 700;
}

.hk-efab {
  position: fixed;
  right: 16px;
  bottom: 96px;
  z-index: 1004;
  height: 56px;
  padding: 0 20px 0 16px;
  border-radius: 16px;
  border: 0;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 8px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}
</style>
