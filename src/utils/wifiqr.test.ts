import { expect, it } from 'vitest'
import { wifiPayload } from './wifiqr'

it('builds the WIFI: payload', () => {
  expect(wifiPayload('udr.hikari-shii.moe', 'secret123', 'sae-mixed')).toBe('WIFI:T:WPA;S:udr.hikari-shii.moe;P:secret123;;')
  expect(wifiPayload('Home', 'x', 'sae')).toBe('WIFI:T:SAE;S:Home;P:x;;')
  expect(wifiPayload('Cafe', '', 'none')).toBe('WIFI:T:nopass;S:Cafe;;')
  expect(wifiPayload('Hidden', 'pw', 'psk2', true)).toBe('WIFI:T:WPA;S:Hidden;P:pw;H:true;;')
})

it('escapes the special characters', () => {
  expect(wifiPayload('a;b,c:d"e\\f', 'p;w', 'psk2')).toBe('WIFI:T:WPA;S:a\\;b\\,c\\:d\\"e\\\\f;P:p\\;w;;')
})
