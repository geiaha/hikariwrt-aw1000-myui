# Design

The source of truth is the **"Material You exploration" boards** on the design
canvas (https://claude.ai/artifact/W8UQ1ZKQEgsr641pRVWgsz): *Dashboard ·
Material You*, *Cellular · Material You* and *Phone · Material You*. Build new
pages in the same language. The earlier boards (dark sidebar, Sora and IBM Plex)
are superseded. Vuetify 4 (`md3` blueprint) supplies the plumbing; the
distinctive pieces are our own components, drawn to match the boards.

## Colour

- **Generation.** The palette comes from one seed colour in `src/theme/material.ts`,
  using `material-color-utilities`, the same code Android uses for wallpaper colour.
  - **Seed:** the canvas's four palettes are the presets: Amber `#E8A317`
    (default), Teal, Indigo and Sakura. Tonal spot keeps only the seed's hue,
    so these seeds reproduce the drawn primary, primary-container and
    surface-container tones exactly, in light and dark (pinned by a test in
    `material.test.ts`). There is also a custom picker.
  - **Scheme style:** Tonal spot (default), Vibrant, Expressive, Neutral or
    Monochrome.
  - **Contrast:** Standard 0, Medium 0.5 or High 1.
  - **Mode:** Auto (follows the OS), Light or Dark.
- **Storage.** Appearance is a per-browser preference in localStorage
  (`stores/appearance.ts`), not router config. It is set in the menu drawer;
  the boards have no palette button in the header.

### Vuetify ↔ M3 mapping

Vuetify colour names mostly match M3 roles. The exceptions:

| Vuetify name | Filled with M3 role | Why |
|---|---|---|
| `surface-variant` / `on-surface-variant` | `inverse-surface` / `inverse-on-surface` | Vuetify uses this pair for tooltips, snackbars and flat chips, which M3 draws inverted. |
| `on-surface-muted` (custom) | `on-surface-variant` | M3's medium-emphasis text and icon colour. Use the `.text-muted` class. |
| `surface-light` | `surface-container-high` | Vuetify's alert and autocomplete surface. |
| `success`, `warning`, `info` (+ `on-`, `-container`, `on-…-container`) | M3 *custom colours*, harmonised toward the seed | M3 has no status roles. |
| `border-color` variable | `outline-variant` at opacity 1 | Dividers and outlined cards. |

All of M3's other roles exist under their own names: `primary-container`,
`surface-container-lowest…highest`, `surface-dim`/`-bright`, `outline`,
`tertiary*`, `error-container`, `inverse-primary` and so on. Use them as
`color="primary-container"` on components, or as the `bg-*`/`text-*` classes.

**Theme-update rule.** When the theme changes at runtime, merge into
`theme.themes.value[name].colors` and `.variables`; don't replace them. Vuetify
needs its default `theme-on-dark` and `theme-on-light` variables to derive the
`on-*` colours we don't set ourselves (see `App.vue`).

## Type

- **Faces:** Outfit (display and headings) and Figtree (everything else), with
  tabular figures everywhere. Both are bundled via @fontsource (Latin): the UI
  must work when the router has no internet, which is often exactly when
  people open it.
- **Classes** (`styles/app.css`), as used on the boards:

| Class | Use | Spec |
|---|---|---|
| `.hk-overline` | line above a page title ("HikariWrt · Arcadyan AW1000") | Figtree 14/600, muted |
| `.hk-h1` | page title | Outfit 34/500, -0.2px |
| `.hk-h2` | card title | Outfit 20/500 |
| `.hk-display` | big numbers and statuses ("Online", "−98") | Outfit 500, size set inline |
| `.hk-label` | fact labels | 12px, muted |

## Shape and surfaces

| Element | Colour | Radius |
|---|---|---|
| Page and rail | `surface` | — |
| Hero (Internet on Home, Signal on Cellular) | `primary-container` / `surface-container` | 32 |
| Card (`.hk-card`) | `surface-container`, padding 22/24 | 24 |
| Tile inside a card (`.hk-tile`) | `surface-container-lowest` | 16 (20 on Cellular) |
| Status chip (`.hk-chip`) | tonal = `tertiary-container` + check; outline = `outline-variant`; filled = `primary`; error | 8 |
| Connected list (`.hk-group`) | rows 2px apart | 12 outer / 4 inner |
| Search field | `surface-container-high`, 56 tall | pill |
| Buttons | primary filled, `secondary-container` tonal, outlined, text; 14px/600 labels | pill |

## Layout

| Width | Navigation |
|---|---|
| ≥ 600 px | **Navigation rail**, 104 px on `surface`: menu button, speed-test FAB (56, `primary-container`, radius 16), destinations (56×32 pill in `secondary-container`), "Advanced" at the bottom. Each page draws its own header: overline, title, actions, search, log out (48 round, `tertiary-container`). |
| < 600 px | **Top app bar** (logo, search, log out), **bottom bar** (Home, Cellular, Clients, More; 64×32 pills on `surface-container`), and an extended "Speed test" FAB on Home. |

- **Menu drawer:** the menu button and "More" open a modal drawer with every
  destination, Appearance, LuCI and log out.
- **Destinations** live in `src/nav.ts` (Home, Internet, Cellular, Wireless,
  Clients, VPN, Mesh, Storage, System).
- **Card grids:** `.hk-grid-3` gives 3 columns, then 2 below 1280 px, then 1
  below 840 px. The Cellular overview is 2 + 1 columns.

## Components

| Component | What |
|---|---|
| `icons/HkIcon` + `registry.ts` | The canvas's own stroke icons (24×24, round caps). Add icons to the registry; don't mix in other sets. |
| `m3/M3Switch` | 52×32 switch, check in the thumb, busy spinner |
| `m3/QuickTile` | quick-settings tile (76 tall desktop, 64 phone) |
| `m3/SegmentedButton` | single-select segmented button |
| `m3/M3Progress` | linear progress with gap and stop dot; `tone` error/tertiary |
| `m3/ArcGauge`, `m3/ProgressRing` | 270° gauge (RSRP), full ring (data used) |
| `m3/SignalBars` | five rising bars |
| `sms/*` | Messages-style SMS: `ConversationList`, `ThreadView` (bubbles, composer), `SmsAvatar` (initial or person on one of four container colours) |
| `m3/DailyBars` | stacked daily usage bars (download primary, upload tertiary) |
| `PageHeader`, `GlobalSearch` | page header; search over pages, sections, clients |
| `SpeedTestDialog`, `ConfirmHost` | app-wide dialogs (`useUi().openSpeedTest()`, `useConfirm().ask()`) |

## Known departures from the boards

- **Mesh backhaul:** a status chip with a link, not a switch. aw1000-mesh has
  `off` but no simple `on`; turning it back on re-runs its setup.
- **IP passthrough tile:** shows router or bridge mode, and opens the LuCI
  Router mode page to switch, because that change has its own confirm and
  rollback flow.
- **Firmware row:** "Upgrade" (links to LuCI's flash page), not "Check for
  update": there is no update-check backend yet.
- **Tiles for features that aren't set up** (no WireGuard tunnel, no guest
  network) say "Not set up" and open the relevant page.

## Writing

- Plain words. "Wired WAN", "5G cellular", "In use", "Standby".
- Settings describe outcomes ("Turn off 5 GHz Wi-Fi"), not UCI option names.
- Numbers use decimal units (kB, MB, GB) everywhere, like the storage manager and
  ISP plans.
