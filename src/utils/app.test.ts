import { afterEach, describe, expect, it, vi } from 'vitest'
import { androidBrowser, appDownload, copyText, inApp, setBars } from './app'

const g = globalThis as { HikariApp?: unknown }

describe('without the app', () => {
  it('uses the browser', async () => {
    expect(inApp()).toBe(false)
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText }, userAgent: '' })
    expect(await copyText('abc')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(appDownload('/cgi-bin/cgi-backup', { sessionid: 'x' }, 'b.tar.gz')).toBe(false)
    setBars('#ffffff', '#eeeeee', false) // no-op, no throw
  })
  it('reports a clipboard failure instead of throwing', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('insecure')) }, userAgent: '' })
    expect(await copyText('abc')).toBe(false)
  })
  afterEach(() => vi.unstubAllGlobals())
})

describe('inside the app', () => {
  const b = { version: () => '0.1.0', setBars: vi.fn(), copy: vi.fn(() => true), download: vi.fn(() => true) }
  afterEach(() => {
    delete g.HikariApp
    vi.unstubAllGlobals()
  })
  it('goes through the bridge', async () => {
    g.HikariApp = b
    expect(inApp()).toBe(true)
    expect(await copyText('join-code')).toBe(true)
    expect(b.copy).toHaveBeenCalledWith('join-code')
    setBars('#1e1e1e', '#2a2a2a', true)
    expect(b.setBars).toHaveBeenCalledWith('#1e1e1e', '#2a2a2a', true)
    expect(appDownload('/cgi-bin/cgi-backup', { sessionid: 's1' }, 'backup.tar.gz')).toBe(true)
    expect(b.download).toHaveBeenCalledWith('/cgi-bin/cgi-backup', '{"sessionid":"s1"}', 'backup.tar.gz')
  })
})

describe('androidBrowser', () => {
  it('is an Android browser, not the app, not a desktop', () => {
    expect(androidBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile')).toBe(true)
    expect(androidBrowser('Mozilla/5.0 (Linux; Android 14; wv) Chrome/126 Mobile HikariWrtApp/0.1.0')).toBe(false)
    expect(androidBrowser('Mozilla/5.0 (X11; Linux x86_64) Firefox/140')).toBe(false)
  })
})
