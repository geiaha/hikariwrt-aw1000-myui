// The "WIFI:" payload phones understand when they scan a QR code (the
// ZXing format both Android and iOS cameras read). Special characters in
// the name and password are backslash-escaped.

const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')

/** encryption as in uci wireless (sae, sae-mixed, psk2, psk-mixed, none, owe). */
export function wifiPayload(ssid: string, key: string, encryption: string, hidden = false): string {
  const open = encryption === 'none' || encryption === 'owe'
  const t = open ? 'nopass' : encryption === 'sae' ? 'SAE' : 'WPA'
  return `WIFI:T:${t};S:${esc(ssid)};${open ? '' : `P:${esc(key)};`}${hidden ? 'H:true;' : ''};`
}
