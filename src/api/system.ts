// System: name and time, admin password, firmware, backup, reboot, reset,
// log. Uploads and downloads go through cgi-io (cgi-upload / cgi-backup),
// which checks the rpcd session and its file ACLs like any ubus call.

import { call, getSession } from './ubus'
import * as uci from './uci'
import { appDownload } from '@/utils/app'

// ---- name and time ----

export interface SystemSettings {
  section: string
  hostname: string
  zonename: string
  ntp: boolean
}

export async function systemSettings(): Promise<SystemSettings> {
  const v = await uci.getConfig('system')
  const s = Object.values(v).find((x) => x['.type'] === 'system')!
  return {
    section: s['.name'],
    hostname: String(s.hostname ?? 'OpenWrt'),
    zonename: String(s.zonename ?? 'UTC'),
    ntp: v.ntp?.enabled !== '0',
  }
}

export const timezones = () => call<Record<string, { tzstring: string }>>('luci', 'getTimezones')
export const localtime = () => call<{ result: number }>('luci', 'getLocaltime').then((r) => r.result)
/** Set the router clock (seconds since epoch), e.g. from this browser. */
export const setLocaltime = (t: number) => call('luci', 'setLocaltime', { localtime: t })

/** zonename is the IANA name; timezone is the POSIX string the libc uses. */
export async function saveSystem(section: string, hostname: string, zonename: string, tzstring: string): Promise<void> {
  try {
    await uci.set('system', section, { hostname, zonename, timezone: tzstring })
    await uci.commit('system')
  } catch (e) {
    await uci.revert('system').catch(() => undefined)
    throw e
  }
}

export const setPassword = (password: string) =>
  call<{ result?: boolean }>('luci', 'setPassword', { username: 'root', password })

// ---- firmware ----

async function upload(file: File, path: string): Promise<void> {
  const body = new FormData()
  body.append('sessionid', getSession())
  body.append('filename', path)
  body.append('filemode', '0600')
  body.append('filedata', file)
  const r = await fetch('/cgi-bin/cgi-upload', { method: 'POST', body })
  if (!r.ok) throw new Error(`Upload failed (HTTP ${r.status}): ${(await r.text()).slice(0, 120)}`)
}

export interface FirmwareCheck {
  valid: boolean
  forceable: boolean
  allow_backup: boolean
  tests?: Record<string, boolean>
}

export const FIRMWARE_PATH = '/tmp/firmware.bin'

/** Upload the image and ask sysupgrade whether it fits this board. */
export async function uploadFirmware(file: File): Promise<FirmwareCheck> {
  await upload(file, FIRMWARE_PATH)
  return call<FirmwareCheck>('system', 'validate_firmware_image', { path: FIRMWARE_PATH })
}

/** Flash the uploaded image and reboot. `keep` keeps settings. */
export const startUpgrade = (keep: boolean) => call('rpc-sys', 'upgrade_start', { keep })
/** Throw the uploaded image away. */
export const discardFirmware = () => call('file', 'remove', { path: FIRMWARE_PATH }).catch(() => undefined)

// ---- backup ----

/**
 * Download a settings backup. cgi-backup answers a form POST with the
 * archive as an attachment, so a throwaway form is the simplest way to get
 * the browser to save it.
 */
export function downloadBackup(): void {
  // In the Android app a WebView can't save a POSTed download, so the app
  // re-issues it natively into Downloads.
  const name = `backup-${location.hostname}-${new Date().toISOString().slice(0, 10)}.tar.gz`
  if (appDownload('/cgi-bin/cgi-backup', { sessionid: getSession() }, name)) return
  const f = document.createElement('form')
  f.method = 'POST'
  f.action = '/cgi-bin/cgi-backup'
  f.style.display = 'none'
  const i = document.createElement('input')
  i.name = 'sessionid'
  i.value = getSession()
  f.appendChild(i)
  document.body.appendChild(f)
  f.submit()
  f.remove()
}

export const BACKUP_PATH = '/tmp/backup.tar.gz'

/** Restore settings from a backup archive; the router then reboots. */
export async function restoreBackup(file: File): Promise<void> {
  await upload(file, BACKUP_PATH)
  const r = await call<{ code: number; stderr?: string }>('file', 'exec', { command: '/sbin/sysupgrade', params: ['--restore-backup', BACKUP_PATH] })
  if (r.code !== 0) throw new Error(r.stderr?.trim() || 'The backup could not be restored.')
  await call('system', 'reboot')
}

// ---- power ----

export const reboot = () => call('system', 'reboot')
/** Erase every setting and reboot to defaults (LAN back to 192.168.1.1). */
export const factoryReset = () => call('rpc-sys', 'factory')

// ---- log ----

/** The last `lines` lines of the system log, oldest first. */
export async function readLog(lines = 300): Promise<string[]> {
  const r = await call<{ code: number; stdout?: string }>('file', 'exec', { command: '/sbin/logread', params: ['-l', String(lines)] })
  return (r.stdout ?? '').split('\n').filter(Boolean)
}
