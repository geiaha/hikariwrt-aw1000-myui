# HikariWrt UI

A Material You admin interface for the HikariWrt build of the Arcadyan AW1000,
following the Material You boards on the design canvas. It covers the everyday
jobs on phone-friendly pages:

- **Home:** connection overview.
- **Internet:** WAN and multi-WAN.
- **Cellular:** signal, bands and cell lock, SMS in a Messages-style layout,
  APN, data usage, AT console.
- **Wireless:** bands and guest Wi-Fi.
- **Clients.**
- **VPN:** WireGuard.
- **Mesh.**
- **Storage:** USB drives and extroot.
- **System:** firmware, backup, password, log.

LuCI stays installed behind **Advanced settings** for everything else.

- **Stack:** Vue 3, Vuetify 4 (Material 3 blueprint), Pinia, vue-router and Vite.
- **Colour:** generated from one seed colour by Google's
  `material-color-utilities`, with light, dark, contrast levels and scheme styles.
- **Backend:** none of its own. The UI is static files calling rpcd over
  uhttpd's `/ubus` JSON-RPC endpoint. It reuses the `luci.aw1000-*` rpcd
  plugins from the [hikariwrt feed](../hikariwrt-aw1000) plus stock objects
  (`system`, `network.*`, `uci`, `luci-rpc`).
- **Served at:** `http://<router>/webui/`.

## Getting started

Node 22 LTS is installed user-local at `~/.local/opt/node`. Put it on PATH:

```sh
fish_add_path ~/.local/opt/node/bin      # fish, once
# or: export PATH=$HOME/.local/opt/node/bin:$PATH
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 with `/ubus` proxied to the router, so data is live. Use `ROUTER=http://x.x.x.x npm run dev` for another router. |
| `npm test` | Unit tests (Vitest). |
| `npm run build` | Type-check and build into `dist/`. |
| `npm run deploy` | Build, copy to the router's `/www/webui`, and install the rpcd ACL. `ROUTER=root@x.x.x.x` overrides the target. Needs SSH access. |
| `npm run package` | Build and stage the app into `openwrt/hikari-ui/files/` for the OpenWrt package. |

## Building the OpenWrt package

The package ships prebuilt files, so the OpenWrt build machine needs no Node.

```sh
npm run package
# in the SDK (openwrt-ipq), once:
echo "src-link hikariui $PWD/openwrt" >> feeds.conf
./scripts/feeds update hikariui && ./scripts/feeds install -p hikariui hikari-ui
# then enable LuCI > Applications > hikari-ui and build as usual
```

To remove a test deploy from the router:

```sh
rm -rf /www/webui /usr/share/rpcd/acl.d/hikari-ui.json
/etc/init.d/rpcd reload
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the UI talks to the router, sessions, ACLs, safe apply, packaging.
- [docs/DESIGN.md](docs/DESIGN.md): Material You tokens, the Vuetify colour mapping, layout and components.
- [docs/ROADMAP.md](docs/ROADMAP.md): phases, which backend each page uses, open decisions.
