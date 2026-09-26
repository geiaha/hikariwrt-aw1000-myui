# HikariWrt UI: working notes

Material You admin UI for the HikariWrt AW1000 build. Read README.md and
docs/ARCHITECTURE.md first. docs/DESIGN.md sets the look; docs/ROADMAP.md says
what comes next.

## Environment

- Node lives at `~/.local/opt/node/bin`. It is not on the default PATH; prefix
  commands with `export PATH=$HOME/.local/opt/node/bin:$PATH;`.
- The test router is `192.168.88.1`. `npm run dev` proxies `/ubus` to it;
  `npm run deploy` needs SSH as root.
- Pin TypeScript to 6.x. vue-tsc cannot load TypeScript 7 yet (it fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED ./lib/tsc`).
- Vitest must inline `@material/material-color-utilities` (extensionless ESM
  imports); see vite.config.ts.

## Rules

- **Backend.** All router access goes through `src/api/ubus.ts` `call()`. No
  new server code in this repo. If a page needs data no ubus object provides,
  the change belongs in the hikariwrt feed (`../hikariwrt-aw1000`). Propose it
  and ask before touching that repo.
- **ACL.** Every new ubus call must be allowed in
  `openwrt/hikari-ui/files/usr/share/rpcd/acl.d/hikari-ui.json`, unless an
  installed `luci-app-aw1000-*` ACL group already grants it.
- **ACL denials look like expiry.** uhttpd returns `-32002` for both;
  `ubus.ts` tells them apart. A new call missing from the ACL therefore fails
  with a clear message rather than signing the user out, but still add it to
  the ACL.
- **The AT port is shared and slow.** Never poll anything that sends AT
  commands. Poll only cached status; refreshes and scans are user actions.
- **Settings that can cut off access** (LAN, Wi-Fi, firewall) use
  `applyWithRollback()`, never a plain commit.
- **Test writes carefully.** Anything that can cut the test machine off
  (Wi-Fi, LAN, passthrough) or change the live modem (bands, locks) needs the
  user's OK before you exercise it on the router. Restore anything you flip,
  and note that a shell `uci commit` doesn't reload services the way rpcd's
  commit does (run the init script's reload).
- **Colour.** Use M3 role names (`primary-container`,
  `surface-container-high`, `.text-muted`…); no hex in components. Remember that
  Vuetify's `surface-variant` is the *inverse* surface here (docs/DESIGN.md).
- **Theme updates** merge into existing colours and variables; never replace the
  objects.
- **Design.** Follow the Material You boards on the design canvas
  (docs/DESIGN.md has the tokens, components and known departures). Use the
  `.hk-*` classes and `components/m3/*` before reaching for a stock Vuetify
  look.
- **Icons** come from the canvas: add them to
  `src/components/icons/registry.ts` and render them with `HkIcon`.
- **Destinations** are added in `src/nav.ts` (with `requires` when a feed
  package backs the page).
- **Style.** Comments explain *why*, as in the feed. Keep the surrounding
  density.
- **Units.** Sizes are decimal (`utils/format.ts` `bytes`).

- **Dry-run risky saves.** For settings that would cut a connection, stage
  the exact uci payload in an rpcd session, read `uci changes`, then
  `uci revert` without committing.

## Checking work

1. `npm test` and `npm run build`, which runs `vue-tsc`, must pass.
2. Check the UI in a real browser against the router, in light and dark, at
   phone width and at desktop width.
3. Scan the dev-server log (`/tmp/claude-1000/myui-vite.log` when started as
   in these sessions) for `[Vue warn]` and unhandled rejections: Vue catches
   component errors, so a page can half-render with no window error.
4. Before calling a page done, deploy it and test it at
   `http://192.168.88.1/webui/`. The dev server hides path bugs; for example,
   the ubus endpoint must be absolute.
