// The router's copy of the appearance, in /etc/config/hikariui:
//
//   config appearance 'appearance'
//       option seed '#E8A317'
//       option variant 'tonal-spot'
//       option contrast '0'
//       option mode 'system'
//
// The package ships the section; a router whose hikariui config predates it
// (conffiles are kept across upgrades) gets it created on the first save.

import { call, UbusError } from './ubus'
import * as uci from './uci'
import type { Appearance } from '@/stores/appearance'

/**
 * The saved options (possibly none), or null when there's no hikariui config
 * at all. rpcd answers a missing *section* with success and no values, but a
 * missing *config* with Not found - so an error here means the config isn't
 * there (or can't be read), and an empty reply means nothing saved yet.
 */
export async function load(): Promise<Record<string, string> | null> {
  let r: { values?: Record<string, unknown> }
  try {
    r = await call<{ values?: Record<string, unknown> }>('uci', 'get', { config: 'hikariui', section: 'appearance' })
  } catch {
    return null
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(r?.values ?? {})) if (!k.startsWith('.') && typeof v === 'string') out[k] = v
  return out
}

export async function save(v: Appearance): Promise<void> {
  const values = { seed: v.seed, variant: v.variant, contrast: String(v.contrast), mode: v.mode }
  try {
    try {
      await uci.set('hikariui', 'appearance', values)
    } catch (e) {
      if (!(e instanceof UbusError && (e.code === 4 || e.code === 5))) throw e
      await call('uci', 'add', { config: 'hikariui', type: 'appearance', name: 'appearance', values })
    }
    await uci.commit('hikariui')
  } catch (e) {
    await uci.revert('hikariui').catch(() => undefined)
    throw e
  }
}
