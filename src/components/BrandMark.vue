<script setup lang="ts">
// Round logo tile in primary-container with the Hikari sun, plus wordmark.
withDefaults(defineProps<{ size?: number; label?: boolean }>(), { size: 40, label: true })
</script>

<template>
  <div class="d-flex align-center ga-3">
    <div class="hk-brand-logo" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :width="size * 0.55" :height="size * 0.55" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    </div>
    <span v-if="label" class="hk-brand-word">HikariWrt</span>
  </div>
</template>

<style scoped>
.hk-brand-logo {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  flex: none;
}
.hk-brand-word {
  font-family: var(--hk-display);
  font-weight: 500;
  font-size: 22px;
}
</style>
