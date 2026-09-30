<script setup lang="ts">
import { onMounted, ref } from 'vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { androidBrowser } from '@/utils/app'

// "Get the Android app", for someone on an Android phone's browser. The APK
// ships with the web UI (android/build.sh, staged by `npm run package`), so it
// is only offered when the router actually has it, and never inside the app.
const APK = './HikariWrt.apk'
const show = ref(false)
const location = window.location
onMounted(async () => {
  if (!androidBrowser()) return
  try {
    const r = await fetch(APK, { method: 'HEAD', cache: 'no-store' })
    show.value = r.ok
  } catch {
    /* not offered */
  }
})
</script>

<template>
  <section v-if="show" class="hk-card hk-app" aria-label="Android app" style="gap: 12px">
    <div class="d-flex align-center ga-3">
      <span class="hk-app__icon"><HkIcon name="router" :size="26" /></span>
      <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
        <h2 class="hk-h2">HikariWrt for Android</h2>
        <span class="hk-label">This router in its own app: full screen, no browser bar</span>
      </div>
    </div>
    <p class="hk-label" style="margin: 0">
      The first time, your browser asks to be allowed to install apps; allow it, then open the downloaded file.
      The app asks for this router’s address ({{ location.host }}) when it starts.
    </p>
    <v-btn :href="APK" download="HikariWrt.apk" variant="flat" color="primary" height="44" rounded="pill" class="align-self-start">
      <HkIcon name="advanced" :size="18" class="mr-2" />Download the app
    </v-btn>
  </section>
</template>

<style scoped>
.hk-app {
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.hk-app .hk-label {
  color: inherit;
  opacity: 0.85;
}
.hk-app__icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-primary));
}
</style>
