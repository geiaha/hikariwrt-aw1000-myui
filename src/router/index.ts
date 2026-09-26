import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { NAV } from '@/nav'
import { useSession } from '@/stores/session'

// Hash history: uhttpd serves plain files and has no SPA fallback, so
// /hikari/#/cellular survives a reload where /hikari/cellular would 404.

// Pages that exist; everything else in NAV gets the placeholder.
const BUILT: Record<string, () => Promise<unknown>> = {
  home: () => import('@/views/HomeView.vue'),
  cellular: () => import('@/views/CellularView.vue'),
  internet: () => import('@/views/InternetView.vue'),
  wifi: () => import('@/views/WirelessView.vue'),
  clients: () => import('@/views/ClientsView.vue'),
}

const pages: RouteRecordRaw[] = NAV.map((n) => ({
  path: n.path,
  name: n.name,
  meta: { title: n.title },
  component: BUILT[n.name] ?? (() => import('@/views/PlaceholderView.vue')),
  props: n.name in BUILT ? false : { item: n },
}))

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/', component: () => import('@/layouts/AppShell.vue'), children: pages },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
})

let restored = false
router.beforeEach(async (to) => {
  const session = useSession()
  if (!restored) {
    restored = true
    await session.restore()
  }
  if (to.meta.public) return session.loggedIn ? { path: '/' } : true
  if (!session.loggedIn) return { name: 'login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  return true
})

router.afterEach((to) => {
  const session = useSession()
  const host = session.board?.hostname ?? 'HikariWrt'
  document.title = to.meta.title ? `${to.meta.title} · ${host}` : host
})

// After a redeploy, a tab opened on the old build asks for chunk files that
// no longer exist. Load the page fresh (once) instead of failing silently.
router.onError((err, to) => {
  const stale = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(err))
  if (stale && !sessionStorage.getItem('hikari.reloaded')) {
    sessionStorage.setItem('hikari.reloaded', '1')
    window.location.hash = to.fullPath
    window.location.reload()
  }
})
router.afterEach(() => {
  try {
    sessionStorage.removeItem('hikari.reloaded')
  } catch {
    /* ignore */
  }
})

export default router
