<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import HkIcon from '@/components/icons/HkIcon.vue'
import { luciUrl, type NavItem } from '@/nav'

// Stand-in for pages that aren't built yet: says when they're coming and
// links to the LuCI page that does the job today.
defineProps<{ item: NavItem }>()
</script>

<template>
  <PageHeader overline="HikariWrt" :title="item.title" />
  <section class="hk-card hk-soon">
    <span class="hk-soon__icon"><HkIcon :name="item.icon" :size="32" /></span>
    <h2 class="hk-h2" style="font-size: 24px">{{ item.title }} is on the way</h2>
    <p class="text-muted">This page arrives in phase {{ item.phase }} of the roadmap. Until then, the same settings are in LuCI.</p>
    <v-btn :href="luciUrl(item.luci)" variant="flat" color="primary" height="44">
      Open in LuCI <HkIcon name="advanced" :size="18" class="ml-2" />
    </v-btn>
  </section>
</template>

<style scoped>
.hk-soon {
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  gap: 12px;
  max-width: 720px;
}
.hk-soon__icon {
  width: 72px;
  height: 72px;
  border-radius: 36px;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
</style>
