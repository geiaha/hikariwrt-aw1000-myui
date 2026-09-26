// First-run state. /etc/config/hikariui (shipped by the package) holds
// setup.done; the package's uci-defaults marks already-configured routers
// done so they never see the wizard pop up.

import { call, NULL_SESSION } from './ubus'
import * as uci from './uci'

/** true = done, false = not yet, null = no hikariui config (treat as done). */
export async function setupDone(): Promise<boolean | null> {
  try {
    const s = await uci.getSection('hikariui', 'setup')
    return s.done === '1'
  } catch {
    return null
  }
}

/**
 * Record that setup finished. Without the package's /etc/config/hikariui
 * (the UI copied onto a router by hand) there is nothing to record into, and
 * rpcd can't create config files, so that case is skipped rather than
 * failing the wizard's last step.
 */
export async function markSetupDone(): Promise<void> {
  if ((await setupDone()) === null) return
  try {
    await uci.set('hikariui', 'setup', { done: '1' })
    await uci.commit('hikariui')
  } catch (e) {
    await uci.revert('hikariui').catch(() => undefined)
    throw e
  }
}

/**
 * Does root have a password? rpcd accepts any password for an account with
 * an empty hash (rpc_login_test_password), so a blank login succeeding means
 * this is a fresh or reset router. Returns the session on success.
 */
export async function blankPasswordLogin(): Promise<string | null> {
  try {
    const r = await call<{ ubus_rpc_session: string }>('session', 'login', { username: 'root', password: '', timeout: 3600 }, { sid: NULL_SESSION })
    return r.ubus_rpc_session
  } catch {
    return null
  }
}

/** Is a cable plugged into the WAN port? */
export async function wanCarrier(): Promise<boolean | null> {
  try {
    const r = await call<{ carrier?: boolean }>('network.device', 'status', { name: 'wan' })
    return r.carrier ?? null
  } catch {
    return null
  }
}
