# Roadmap

The estimate is 10–15 working sessions, about 1½–3 weeks with testing in
between. Phase numbers match `phase` in `src/nav.ts`; each unbuilt page's
placeholder names its phase.

## Phase 0: foundation ✅

- **Toolchain and theme:**
  - Vite, Vue 3, Vuetify 4 (md3 blueprint), Pinia, vue-router and TypeScript 6;
  - Material You theme generation with appearance settings.
- **API and sign-in:**
  - ubus JSON-RPC client with batching and session expiry;
  - uci helpers with safe apply and rollback;
  - login/logout against rpcd.
- **Shell:** responsive navigation (drawer, rail, bottom bar), with feature
  detection for feed packages.
- **Dashboard (read-only, live):** Internet uplinks (active / standby), 5G
  cellular, Wi-Fi, clients and system.
- **Packaging and tooling:**
  - OpenWrt package `hikari-ui` with its rpcd ACL;
  - deploy and package scripts;
  - unit tests.
- **Verified on the router** (`/hikari/`): sign-in, wrong-password message,
  dashboard data, and that sign-out destroys the session.

## Design pass ✅ (following the canvas's Material You boards)

- **Shell, Home and Cellular overview rebuilt to match the boards:**
  - rail, per-page header, global search, phone app bar, bottom bar and FAB;
  - Outfit and Figtree type, the canvas's icons, and its four palettes as
    presets.
- **Home (live):**
  - connection hero and diagram (from multi-WAN status);
  - Wired WAN, 5G, Multi-WAN (mode switch works);
  - Wi-Fi (band switches with rollback), Quick settings (WireGuard, ad
    blocking and guest Wi-Fi switch; passthrough hands over to LuCI);
  - System (CPU from `/proc/stat`, memory, USB storage);
  - on phones: Clients, 5G data.
- **Cellular overview (live):**
  - signal gauge, metric tiles (temperature from `diag`), cell facts (gNB ID
    derived);
  - 5G band lock (Apply re-registers);
  - SIM, data this month, latest messages;
  - Refresh and Reconnect.
- **Speed test dialog** (aw1000-speedtest, live progress).
- **Verified on the router:**
  - search;
  - theme switching;
  - a full speed test over WAN;
  - multi-WAN failover ↔ balance round trip;
  - ad blocking on/off;
  - the passthrough dialog;
  - 5G reconnect.
- **Not exercised on the router:**
  - Wi-Fi and guest switches, which could cut off the test machine;
  - band Apply, which changes the live modem config;
  - WireGuard (no tunnel configured).

## Phase 1: building blocks (1–2 sessions)

- **Settings patterns:** M3 list-style settings rows (switch, select, text,
  navigation) and a sticky "unsaved changes" bar. The bar stages with `uci set`
  and finishes with commit or safe apply.
- **Dialogs:** confirm and destructive-action dialogs (type-to-confirm for
  format, factory reset and similar).
- **States:** empty, error and loading states, plus skeleton conventions.
- **Mock mode:** recorded, scrubbed fixtures for working without the router.
  Never commit IMEI, IMSI or ICCID.
- **Smoke test in the repo:** the Selenium check used during phase 0.
- **Dashboard quick controls:** Wi-Fi on/off per band, VPN on/off. They need the
  apply machinery above.

## Phase 2: Cellular ✅

Every tab is built on `luci.aw1000-modem`, in the same language as the
overview.

| Tab | What it does |
|---|---|
| Band & cell lock | Cell lock from known and scanned cells (one 5G, up to the modem's LTE limit, "keep after a reboot"), network scan with progress, forget scan; network mode (Automatic / 5G and LTE / 5G only / LTE only, SA/NSA); 5G and LTE band locks |
| SMS | Laid out like Google Messages: searchable conversation list (avatars, unread dot), conversation as bubbles with day chips and tappable links, pill composer (Enter sends) with a GSM-7 / Unicode counter, "Start chat", pending / failed / retry bubbles, delete message or conversation, overflow menu for refresh, storage and delete all. Phones get list, then a full-screen conversation with Back. The modem keeps received messages only, so sent ones are remembered per browser (`stores/sms.ts`), as is read state |
| APN & IPv6 | APN: automatic, from the carrier list, or custom (auth, credentials, IP type), watching the backend's 45 s verify-or-roll-back; fixed TTL; IPv6 status and assessment. Full IPv6 setup (styles, NAT64, delegation) links to LuCI |
| Data usage | This period with projection, daily chart, totals; allowance, reset day, warn %, cut-off action, SMS warnings; resume after a cut-off; reset period / delete history |
| AT console | Quick commands, history (↑/↓), transcript. There is no blocklist (the backend logs every command); a warning explains why to be careful |

**Verified on the router:**
- every tab renders with live data (desktop, phone, dark);
- AT console (`ATI`, `AT+CSQ`);
- a usage-settings save that left the values unchanged.

**Not exercised on the router**, because each changes or sends something real:
- SMS send and delete, and changing the message store;
- APN and TTL changes;
- cell lock, scan (drops data for about 90 s), network mode, band Apply;
- usage reset.

## Phase 3: network pages (in progress)

### Internet ✅
- **Live status:** the connection hero (the same uplink logic as Home, `uplinkViews`).
- **Wired WAN:** DHCP, PPPoE or static, with DNS, MTU and IPv6 under a
  disclosure. A commit reconnects only the WAN.
- **Multi-WAN:** on/off, failover or balance, priority order (up/down, saved
  as metrics 10/20/…), balance shares, and the SMS alert (recipients, how
  often). Health-check targets link to LuCI.
- **Side cards:** a 5G uplink summary, and router mode (switching stays in
  LuCI).

### Wireless ✅
- **One card per band:**
  - on/off (with rollback);
  - name, password (masked, with reveal), security, hidden;
  - channel and width from what the driver reports.
- **Radios the mesh uses** show channel and width read-only, with a link to
  Mesh, because the mesh needs a fixed channel on every node.
- **Saving name, password or security** asks "Apply safely" (30 s rollback) or
  "Apply now". The latter exists because a rollback always fires when you
  change the Wi-Fi you're connected over.
- **Guest Wi-Fi:** explains what it is, and links to LuCI until setup is built
  here.

**Verified on the router:**
- both pages, live, on desktop, phone and dark;
- a multi-WAN save (alert frequency), then restored;
- reorder and undo;
- static validation;
- the Wi-Fi save dialog (cancelled);
- the exact WAN and Wi-Fi uci payloads staged in an rpcd session and
  reverted.

That dry run found and fixed a bug: rpcd's `uci delete` reports Not found for
missing options.

**Not exercised on the router:**
- a real WAN save (it reconnects PPPoE);
- a real Wi-Fi save or toggle (it drops Wi-Fi clients).

### Guest Wi-Fi ✅ (on the Wireless page)
- **Setup in one step** (`api/guest.ts`):
  - a guest bridge on a free /24 (the first unused 192.168.x from 89);
  - a DHCP pool;
  - a `guest` firewall zone that reaches only the WAN, plus DHCP and DNS on
    the router;
  - an isolated AP per chosen band;
  - applied as one change with 60 s rollback.
- **Naming:** every section is named `hikari_guest*` (plus `guest` for the
  interface and pool), so Remove deletes exactly that.
- **After setup:** on/off for all guest APs, name, password and security,
  Remove.
- **Generated password:** 12 characters with no look-alikes.
- **Foreign setups:** a guest network built in LuCI is detected and left as
  plain band cards.
- **Home's Guest tile** switches every guest AP together.

### Clients ✅
- **One list from several sources** (`utils/clients.ts`, unit tested):
  - DHCP leases, host hints, dnsmasq `host` entries;
  - Wi-Fi associations (live signal, link speeds, data);
  - `hikari_block_*` firewall rules.
- **What it leaves out:** WAN-side neighbours and the router itself.
- **Filters:** All, Wi-Fi, Wired, Guests, Blocked, plus search. `?mac=` opens
  a device, which is how global search links to it.
- **Device sheet** (a side panel on desktop, bottom sheet on phones):
  - details, with a private-address hint for randomised MACs;
  - rename, and reserve an address (a dnsmasq host entry);
  - block internet (fw4 REJECT to WAN; open or NSS-accelerated flows may run
    on briefly);
  - disconnect from Wi-Fi (hostapd `del_client`, no ban).

**Verified on the router:**
- both pages, live;
- a real rename plus reservation, saved and then removed;
- dry runs (staged, then reverted) of the full guest setup (9 sections, 53
  changes) and of a block rule.

**Not exercised:**
- actually creating or removing the guest network (restarts Wi-Fi and the
  firewall);
- blocking or disconnecting a real device.

### Still to build
| Page | Backend |
|---|---|
| VPN | `luci.aw1000-vpn` (`list`, `create`, `import`, `enable`, `remove`, `route`, `egress`, `networks`, `genkey`) |
| Mesh | `luci.aw1000-mesh` (`status`, `peers`, `set`, `join`, `code`, `apply`/`confirm`/`revert`…) |
| Storage | `luci.aw1000-storage` (`status`, `mount`, `umount`, `eject`, `format`, `extroot`, `job`, `settings`) |

## Phase 4: System (1–2 sessions)

- **Settings:** hostname, time zone and time (`luci getTimezones` /
  `setLocaltime`, uci `system`), and the admin password (`luci setPassword`).
- **Firmware upgrade:**
  1. upload via `/cgi-bin/cgi-upload`;
  2. `system validate_firmware_image`;
  3. `rpc-sys upgrade_start`, then wait and reconnect.
- **Backup and restore:** `/cgi-bin/cgi-backup`, and upload plus
  `rpc-sys upgrade_*`/`sysupgrade -r`.
- **Maintenance:** reboot (`system reboot`), factory reset (`rpc-sys factory`),
  and the system log (`log read`).
- **Extras:** NSS status (`luci.aw1000-nss`) and speed test
  (`luci.aw1000-speedtest`).

## Phase 5: polish and ship (about 2 sessions)

- Full pass on phones, dark mode, high contrast, keyboard and screen reader.
- Bundle review (currently about 190 kB gzipped).
- Decide the serving path (below), add hikari-ui to the image, and update the
  READMEs.

## Open decisions

- **Serving path.** Keep `/hikari/`, or make the UI the default at `/` with LuCI
  at `/cgi-bin/luci`? The latter replaces `/www/index.html` (owned by luci-base)
  and needs care in packaging.
- **Languages.** English only for now. If translations are wanted, add vue-i18n
  before phase 2, so strings aren't retrofitted.
- **Non-root users.** rpcd login sections can grant limited ACLs; pages would
  then need to hide controls the session can't write to. Not planned unless
  asked.
