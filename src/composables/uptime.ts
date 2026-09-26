import { computed } from 'vue'
import * as monitor from '@/api/monitor'
import { usePoll } from './poll'
import { useSession } from '@/stores/session'

// 24-hour uptime per WAN from the monitor, for the "99.98% uptime today"
// link on the connection heroes. Once a minute is plenty; null when the
// router has no monitor.
export function useUptimeToday() {
  const session = useSession()
  const has = session.has('luci.aw1000-monitor')
  const st = usePoll(() => (has ? monitor.status().catch(() => null) : Promise.resolve(null)), 60000)
  return computed<Record<string, number | null> | null>(() => {
    const s = st.data.value
    if (!s?.ok) return null
    return Object.fromEntries(s.wans.filter((w) => w.enabled).map((w) => [w.name, w.uptime['24h']]))
  })
}
