<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
import M3Progress from '@/components/m3/M3Progress.vue'

// The wizard's page: brand and "Set up later" on top, step progress, the
// step in one large card, and the actions underneath. Full screen like the
// login page (no navigation rail): setup comes before anything else.
defineProps<{
  index: number
  total: number
  title: string
  lead: string
  canLater?: boolean
}>()
defineEmits<{ later: [] }>()
</script>

<template>
  <v-main class="bg-surface-container">
    <div class="hk-setup">
      <header class="hk-setup__top">
        <BrandMark :size="40" />
        <v-spacer />
        <v-btn v-if="canLater" variant="text" color="primary" @click="$emit('later')">Set up later</v-btn>
      </header>

      <div class="hk-setup__progress">
        <span class="hk-label">Step {{ index + 1 }} of {{ total }}</span>
        <M3Progress :value="((index + 1) / total) * 100" label="Setup progress" :height="6" />
      </div>

      <section class="hk-setup__card" :aria-labelledby="`step-${index}`">
        <h1 :id="`step-${index}`" class="hk-h1">{{ title }}</h1>
        <p class="hk-setup__lead">{{ lead }}</p>
        <slot />
      </section>

      <div class="hk-setup__actions">
        <slot name="actions" />
      </div>
    </div>
  </v-main>
</template>

<style scoped>
.hk-setup {
  max-width: 760px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 20px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hk-setup__top {
  display: flex;
  align-items: center;
  min-height: 48px;
}
.hk-setup__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hk-setup__card {
  background: rgb(var(--v-theme-surface));
  border-radius: 28px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hk-setup__lead {
  margin: -8px 0 8px;
  font-size: 16px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.hk-setup__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 599.98px) {
  .hk-setup {
    padding: 12px 16px 24px;
  }
  .hk-setup__card {
    padding: 22px 20px;
    border-radius: 24px;
  }
  .hk-setup :deep(.hk-h1) {
    font-size: 28px;
  }
}
</style>
