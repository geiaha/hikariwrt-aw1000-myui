// Data for the Home page, polled in two batches (each batch is one HTTP
// request thanks to ubus.ts batching):
//   fast, 5 s:   interfaces, multi-WAN status, modem status, system, CPU
//   slow, 15 s:  clients, Wi-Fi, mesh, VPN, ad blocking, router mode,
//                storage, multi-WAN settings, 5G data usage
// Nothing here talks to the modem's AT port: modem `status`, `usageinfo`
// and `routerstatus` are served from aw1000-modem's cache.

import { computed, ref } from 'vue'
import { call } from '@/api/ubus'
import * as api from '@/api/router'
import * as modem from '@/api/modem'
import * as svc from '@/api/services'
import { usePoll } from '@/composables/poll'
import { useSession } from '@/stores/session'
import { uplinkViews, type UplinkView } from '@/utils/uplinks'

export type { UplinkView } from '@/utils/uplinks'
export type LinkState = 'active' | 'standby' | 'down'

const settled = <T>(p: Promise<T>) => p.then((v) => v, () => null)

export function useHomeData() {
  const session = useSession()
  const hasModem = computed(() => session.has('luci.aw1000-modem'))

  let lastCpu: svc.CpuSample | null = null
  const cpu = ref<number | null>(null)

  const fast = usePoll(async () => {
    const [ifaces, mw, st, info, sample] = await Promise.all([
      api.interfaces(),
      svc.multiwanStatus(),
      hasModem.value ? settled(modem.status()) : Promise.resolve(null),
      api.systemInfo(),
      settled(svc.cpuSample()),
    ])
    if (sample) {
      if (lastCpu) cpu.value = svc.cpuPercent(lastCpu, sample)
      lastCpu = sample
    }
    return { ifaces, mw, modem: st, info }
  }, 5000)

  const slow = usePoll(async () => {
    const radios = await settled(api.wireless())
    // Wi-Fi client MACs, to split the client count into Wi-Fi and wired.
    const apIfnames = Object.values(radios ?? {}).flatMap((r) =>
      r.interfaces.filter((i) => i.config.mode === 'ap' && i.ifname).map((i) => i.ifname!),
    )
    const [leases, aps, assoc, mesh, vpn, adblock, router, storage, mwConf, usage] = await Promise.all([
      settled(api.leases()),
      settled(svc.wifiAps()),
      Promise.all(apIfnames.map((d) => settled(call<{ results: { mac: string }[] }>('iwinfo', 'assoclist', { device: d })))),
      session.has('luci.aw1000-mesh') ? settled(svc.meshStatus()) : Promise.resolve(null),
      session.has('luci.aw1000-vpn') ? settled(svc.vpnList()) : Promise.resolve(null),
      svc.adblockEnabled(),
      hasModem.value ? settled(modem.routerstatus()) : Promise.resolve(null),
      session.has('luci.aw1000-storage') ? settled(svc.storageStatus()) : Promise.resolve(null),
      svc.multiwanConfig(),
      hasModem.value ? settled(modem.usageinfo()) : Promise.resolve(null),
    ])
    const wifiMacs = new Set(assoc.flatMap((a) => a?.results ?? []).map((r) => r.mac.toUpperCase()))
    return { radios, leases, aps, wifiMacs, mesh, vpn, adblock, router, storage, mwConf, usage }
  }, 15000)

  // ---- uplinks: multi-WAN's view when it runs, else the kernel's routes ----

  const uplinks = computed<UplinkView[] | null>(() => {
    const d = fast.data.value
    return d ? uplinkViews(d.ifaces, d.mw) : null
  })

  const active = computed(() => uplinks.value?.find((u) => u.state === 'active') ?? null)
  const wired = computed(() => uplinks.value?.find((u) => !u.cellular) ?? null)
  const cellular = computed(() => uplinks.value?.find((u) => u.cellular) ?? null)
  const lanIp = computed(
    () => fast.data.value?.ifaces.find((i) => i.interface === 'lan')?.['ipv4-address']?.[0]?.address ?? null,
  )

  const clients = computed(() => {
    const s = slow.data.value
    if (!s?.leases) return null
    const wifi = s.leases.filter((l) => s.wifiMacs.has(l.macaddr.toUpperCase())).length
    return { total: s.leases.length, wifi, wired: s.leases.length - wifi, list: s.leases }
  })

  return { fast, slow, cpu, uplinks, active, wired, cellular, lanIp, clients, hasModem }
}

export type HomeData = ReturnType<typeof useHomeData>
