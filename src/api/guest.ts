// Guest Wi-Fi: the standard OpenWrt guest recipe, created and removed as one
// unit so it never exists half-built:
//
//   network   device br-guest (bridge, allowed to be empty) + interface
//             guest (static, its own /24)
//   dhcp      pool for guest
//   firewall  zone guest (input REJECT, forward REJECT), forwarding
//             guest -> wan, and two rules letting guests reach the router's
//             DHCP and DNS only
//   wireless  one isolated AP per chosen band on network guest
//
// Every section this creates is named hikari_guest* (or `guest`, which the
// interface and DHCP pool must be called for other tools to recognise), so
// removal finds exactly what setup made. It all goes in as one uci apply with
// rollback: firewall and Wi-Fi both restart, and if that cuts this browser
// off, rpcd puts everything back.

import { call } from './ubus'
import * as uci from './uci'

export interface GuestState {
  exists: boolean
  /** Anything guest-like that we didn't create (LuCI-made guest setups). */
  foreign: boolean
  subnet: string | null
  aps: { section: string; radio: string; ssid: string; disabled: boolean }[]
}

const ZONE = 'hikari_guest'
const SECTIONS = {
  device: 'hikari_guest_dev',
  forward: 'hikari_guest_wan',
  dhcpRule: 'hikari_guest_dhcp',
  dnsRule: 'hikari_guest_dns',
}

export async function guestState(): Promise<GuestState> {
  const [net, wl, fw] = await Promise.all([uci.getConfig('network'), uci.getConfig('wireless'), uci.getConfig('firewall')])
  const iface = net.guest
  const aps = Object.values(wl)
    .filter((s) => s['.type'] === 'wifi-iface' && s.network === 'guest')
    .map((s) => ({ section: s['.name'], radio: String(s.device), ssid: String(s.ssid ?? ''), disabled: s.disabled === '1' }))
  const ours = !!fw[ZONE]
  const guestZone = Object.values(fw).some((s) => s['.type'] === 'zone' && s.name === 'guest')
  return {
    exists: !!iface && ours,
    foreign: (!!iface || guestZone) && !ours,
    subnet: iface ? `${iface.ipaddr}/24` : null,
    aps,
  }
}

/**
 * A /24 for guests that clashes with nothing the router already has
 * (LAN, WANs, VPNs): the first free 192.168.x.0 from 89 upwards.
 */
export async function freeSubnet(): Promise<string> {
  const r = await call<{ interface: { 'ipv4-address'?: { address: string }[] }[] }>('network.interface', 'dump')
  const used = new Set(
    r.interface.flatMap((i) => i['ipv4-address'] ?? []).map((a) => a.address.split('.').slice(0, 3).join('.')),
  )
  for (let x = 89; x < 255; x++) if (!used.has(`192.168.${x}`)) return `192.168.${x}`
  return '10.89.0'
}

export interface GuestSetup {
  ssid: string
  key: string
  encryption: string
  radios: string[]
  /** First three octets, e.g. "192.168.89". */
  prefix: string
}

async function add(config: string, type: string, name: string, values: Record<string, string | string[]>): Promise<void> {
  await call('uci', 'add', { config, type, name, values })
}

/** Stage every section of the guest network (nothing applied yet). */
export async function stageGuest(g: GuestSetup): Promise<void> {
  await add('network', 'device', SECTIONS.device, { name: 'br-guest', type: 'bridge', bridge_empty: '1' })
  await add('network', 'interface', 'guest', { proto: 'static', device: 'br-guest', ipaddr: `${g.prefix}.1`, netmask: '255.255.255.0' })
  await add('dhcp', 'dhcp', 'guest', { interface: 'guest', start: '100', limit: '150', leasetime: '2h' })
  await add('firewall', 'zone', ZONE, { name: 'guest', network: ['guest'], input: 'REJECT', output: 'ACCEPT', forward: 'REJECT' })
  await add('firewall', 'forwarding', SECTIONS.forward, { src: 'guest', dest: 'wan' })
  await add('firewall', 'rule', SECTIONS.dhcpRule, { name: 'Guest-DHCP', src: 'guest', proto: 'udp', dest_port: '67-68', target: 'ACCEPT', family: 'ipv4' })
  await add('firewall', 'rule', SECTIONS.dnsRule, { name: 'Guest-DNS', src: 'guest', proto: ['tcp', 'udp'], dest_port: '53', target: 'ACCEPT' })
  for (const radio of g.radios) {
    const values: Record<string, string> = { device: radio, mode: 'ap', network: 'guest', ssid: g.ssid, encryption: g.encryption, isolate: '1' }
    if (g.encryption !== 'none') values.key = g.key
    await add('wireless', 'wifi-iface', `hikari_guest_${radio}`, values)
  }
}

const CONFIGS = ['network', 'dhcp', 'firewall', 'wireless']

async function revertAll(): Promise<void> {
  for (const c of CONFIGS) await uci.revert(c).catch(() => undefined)
}

export async function createGuest(g: GuestSetup): Promise<void> {
  try {
    await stageGuest(g)
  } catch (e) {
    await revertAll()
    throw e
  }
  await uci.applyWithRollback(60)
}

/** Stage removal of everything createGuest made (and guest APs on it). */
export async function stageRemoveGuest(): Promise<void> {
  const wl = await uci.getConfig('wireless')
  const aps = Object.values(wl).filter((s) => s['.type'] === 'wifi-iface' && s.network === 'guest')
  const del = (config: string, section: string) =>
    call('uci', 'delete', { config, section }).catch((e: unknown) => {
      if ((e as { code?: number }).code !== 4) throw e
    })
  for (const ap of aps) await del('wireless', ap['.name'])
  await del('firewall', SECTIONS.dnsRule)
  await del('firewall', SECTIONS.dhcpRule)
  await del('firewall', SECTIONS.forward)
  await del('firewall', ZONE)
  await del('dhcp', 'guest')
  await del('network', 'guest')
  await del('network', SECTIONS.device)
}

export async function removeGuest(): Promise<void> {
  try {
    await stageRemoveGuest()
  } catch (e) {
    await revertAll()
    throw e
  }
  await uci.applyWithRollback(60)
}

/** Rename / re-key every guest AP at once. */
export async function updateGuest(aps: string[], ssid: string, encryption: string, key: string, safe: boolean): Promise<void> {
  try {
    for (const s of aps) {
      await uci.set('wireless', s, { ssid, encryption, ...(encryption !== 'none' ? { key } : {}) })
      if (encryption === 'none') await uci.del('wireless', s, ['key'])
    }
  } catch (e) {
    await uci.revert('wireless').catch(() => undefined)
    throw e
  }
  if (safe) await uci.applyWithRollback(30)
  else await uci.applyNow()
}
