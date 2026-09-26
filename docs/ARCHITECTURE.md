# Architecture

## The one rule: everything goes through ubus

```
browser ── fetch POST /ubus (JSON-RPC 2.0) ──► uhttpd-mod-ubus ──► rpcd ──► ubus objects
   │                                                                  │
   └─ static files from /www/hikari (uhttpd)                          ├─ system, network.*, uci, iwinfo, file…
                                                                      ├─ luci, luci-rpc          (rpcd-mod-luci)
                                                                      └─ luci.aw1000-*           (hikariwrt feed)
```

The UI has no server code: no LuCI dispatcher, no CGI and no Lua/ucode on the request
path. A page is a set of ubus calls. When a page needs something no object provides,
the fix belongs in the matching hikariwrt feed package (a new method on its rpcd
plugin), not in this repo. That keeps LuCI and this UI on the same backend, so they
can't drift apart.

## Client: `src/api/ubus.ts`

- `call(object, method, params)` resolves with the reply data, or rejects with a
  `UbusError` (`code` is the ubus status; `expired` is true when the session is
  gone).
- **Batching.** Calls made in the same tick go out as one JSON-RPC batch, as in
  LuCI's `rpc.js`. The dashboard's five polls cost one HTTP request per tick.
- **Endpoint** is absolute (`/ubus`). The app is served from `/hikari/`, but ubus
  sits at the server root.
- `listObjects(pattern)` finds out which feed packages the router has (see
  "Feature detection" below).

## Sessions and ACLs

- **Login** is `session.login` against `/etc/config/rpcd` login sections. Root is
  there by default with the system password. The browser keeps only the
  `ubus_rpc_session` id, in localStorage; the password is never stored.
- **Expiry.** The idle timeout is 3600 s, and every call extends it. When any call
  comes back `-32002 Access denied`, `onSessionExpired` returns the user to the
  login page with a notice.
- **ACLs.** rpcd checks every call against the session's ACL groups. Root's login
  config grants `*`, so root gets every group in `/usr/share/rpcd/acl.d`.
  - The package ships `hikari-ui.json` listing what the UI itself calls. It is
    the only place `session.destroy` is granted; stock ACLs lack it, so sign-out
    couldn't end the session without it.
  - **Every new ubus call a page makes must be added to that file.** Calls that
    already sit in a `luci-app-aw1000-*` group need not be duplicated.
- **Feature detection.** At sign-in the session store lists `luci.aw1000-*`.
  Navigation entries with `requires` (Cellular, VPN, Mesh, Storage) are hidden
  when their object is missing, so a trimmed image shows no dead pages.

## Changing settings safely: `src/api/uci.ts`

rpcd stages `uci set` per session. Nothing reaches `/etc/config` until one of two
things happens:

| Use | When |
|---|---|
| `commit(config)` | The change can't cut the user off (names, SMS alerts, usage limits). procd's config triggers reload the service. |
| `applyWithRollback()` | The change can break the path to the router: LAN IP, the Wi-Fi the user is on, firewall. rpcd applies it and arms a timer; the browser must `uci confirm` before it fires, or rpcd restores the old config. This is LuCI's safe apply. |

Feed rpcd plugins that do their own writes (for example
`luci.aw1000-modem setbands`) are called directly. They already handle their own
locking; the AT-port queue lives in `aw1000-modem`'s `lib.sh`.

## Polling

`usePoll(fn, ms)` runs immediately and then on an interval while the component is
mounted. It pauses while the tab is hidden and never overlaps a slow call.

- **Home** (`composables/home.ts`), in two batches:
  - fast, 5 s: interfaces, multi-WAN status, modem status, system, CPU;
  - slow, 15 s: clients, Wi-Fi, mesh, VPN, ad blocking, router mode, storage,
    multi-WAN settings, usage.
  - After any change, the affected batch refreshes at once.
- **Cellular:** `status` is polled every 5 s. `diag` and the SMS list are
  fetched on open and on Refresh; lock, profile and usage on open and after
  Apply.
- **Modem status is cheap to poll.** `luci.aw1000-modem status` returns the reply
  cached by `aw1000-modem-info`. It does not send AT commands. Anything that
  *does* send them (refresh, scans) must be user-triggered, never polled.

## Routing and serving

- **Hash history** (`/hikari/#/cellular`), because uhttpd has no SPA fallback and
  a reload of `/hikari/cellular` would 404.
- **Relative asset base** (`base: './'`), so the same build works under `/hikari/`
  or `/`.
- **Router guard.** On first navigation it restores a remembered session (by
  calling `system board`); if that fails it sends the user to `/login?next=…`.

## Packaging (`openwrt/hikari-ui`)

- **Contents.** `PKGARCH:=all`, installing:
  - `/www/hikari` (the built app);
  - the rpcd ACL;
  - a uci-defaults script that reloads rpcd so the ACL takes effect.
- **Prebuilt files.** The app is built with Node before the OpenWrt build
  (`npm run package`), and `Build/Prepare` fails loudly if that step was skipped.
  The SDK never needs Node.
- **Dependencies** are only uhttpd, uhttpd-mod-ubus and the rpcd modules. The
  feed apps are deliberately not dependencies; feature detection handles their
  absence.

## Dev loop

- **`npm run dev`** proxies `/ubus` and `/cgi-bin` to the router (`ROUTER`,
  default `http://192.168.88.1`), so development runs against live data.
- **Deploy.** `npm run deploy` does build, tar over ssh into `/www/hikari`, and
  installs the ACL. `http://<router>/hikari/` is then the real thing.
- **Tests.** Vitest covers the pure logic: formatting, uplink selection, theme
  generation. UI behaviour is checked against the router in a browser.
