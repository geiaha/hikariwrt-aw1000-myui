// UCI through rpcd's `uci` object.
//
// rpcd keeps staged changes per session (like `uci -P` delta files), so a
// page can set several options and nothing touches /etc/config until commit
// or apply. Two ways to finish:
//
//  - commit(config): write it and let procd's config triggers reload the
//    service. Right for settings that can't cut you off (SMS alerts, names).
//
//  - applyWithRollback(): LuCI's safe apply. rpcd commits everything staged,
//    reloads, and arms a timer; unless the browser calls `uci confirm` before
//    it fires, rpcd restores the previous config. Use it for anything that
//    can break the path to the router: LAN IP, Wi-Fi of the device you're
//    on, firewall, VLANs.

import { call, UbusError } from './ubus'

export type UciSection = Record<string, string | string[]> & {
  '.name': string
  '.type': string
  '.anonymous': boolean
  '.index'?: number
}

export async function getConfig(config: string): Promise<Record<string, UciSection>> {
  const r = await call<{ values: Record<string, UciSection> }>('uci', 'get', { config })
  return r.values
}

export async function getSection(config: string, section: string): Promise<UciSection> {
  const r = await call<{ values: UciSection }>('uci', 'get', { config, section })
  return r.values
}

/**
 * Set options (staged). An empty list means "no values", but rpcd refuses one
 * with Invalid argument, so those options are deleted instead - which is what
 * uci itself does with a list that has nothing left in it.
 */
export async function set(
  config: string,
  section: string,
  values: Record<string, string | string[]>,
): Promise<void> {
  const empty = Object.keys(values).filter((k) => Array.isArray(values[k]) && values[k].length === 0)
  const rest = Object.fromEntries(Object.entries(values).filter(([k]) => !empty.includes(k)))
  if (Object.keys(rest).length) await call('uci', 'set', { config, section, values: rest })
  if (empty.length) await del(config, section, empty)
}

/**
 * Remove options from a section (staged like set). One call per option,
 * because rpcd answers Not found (4) when an option isn't there, and "make
 * sure it's gone" is what callers mean.
 */
export async function del(config: string, section: string, options: string[]): Promise<void> {
  await Promise.all(
    options.map((option) =>
      call('uci', 'delete', { config, section, option }).catch((e: unknown) => {
        if (!(e instanceof UbusError && e.code === 4)) throw e
      }),
    ),
  )
}

export async function commit(config: string): Promise<void> {
  await call('uci', 'commit', { config })
}

export async function revert(config: string): Promise<void> {
  await call('uci', 'revert', { config })
}

export async function changes(): Promise<Record<string, string[][]>> {
  const r = await call<{ changes?: Record<string, string[][]> }>('uci', 'changes')
  return r.changes ?? {}
}

/**
 * Apply every staged change now, with no rollback timer. For changes the
 * browser can't confirm by design, e.g. the Wi-Fi password of the network
 * it is connected over (it will be disconnected either way).
 */
export async function applyNow(): Promise<void> {
  await call('uci', 'apply', { rollback: false })
}

/**
 * Apply every staged change with automatic rollback. Resolves once the
 * router has been reached again and the change confirmed; rejects if it
 * could not be confirmed in time, in which case rpcd rolls back on its own
 * `timeout` seconds after the apply.
 */
export async function applyWithRollback(timeout = 30): Promise<void> {
  await call('uci', 'apply', { rollback: true, timeout })

  const deadline = Date.now() + timeout * 1000
  // The apply restarts networking; early confirms fail while it settles.
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500))
    try {
      await call('uci', 'confirm')
      return
    } catch (e) {
      // Code 5 (No data) means there is no pending rollback any more:
      // either confirmed already or rolled back. Nothing to retry.
      if (e instanceof UbusError && e.code === 5) throw e
      if (Date.now() > deadline) throw e
    }
  }
}
