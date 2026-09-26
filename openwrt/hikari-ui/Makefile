include $(TOPDIR)/rules.mk

PKG_NAME:=hikari-ui
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=Robin Reyes <me@hikari-shii.moe>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  PKGARCH:=all
  TITLE:=HikariWrt admin UI (Material You front end over rpcd)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  # uhttpd-mod-ubus is the whole backend: the UI is static files that talk
  # JSON-RPC to rpcd at /ubus. rpcd-mod-luci gives the `luci` and `luci-rpc`
  # objects (host hints, leases, block devices) the pages read.
  #
  # The luci-app-aw1000-* packages are not dependencies on purpose: each
  # page detects its rpcd object and hides itself when the matching package
  # isn't installed, so the UI also runs on a trimmed image.
  DEPENDS:=+uhttpd +uhttpd-mod-ubus +rpcd +rpcd-mod-luci +rpcd-mod-file +rpcd-mod-iwinfo
endef

define Package/$(PKG_NAME)/description
	A phone-friendly admin interface for the HikariWrt build of the Arcadyan
	AW1000, in the style of Material You: dashboard, cellular, internet,
	Wi-Fi, clients, VPN, mesh and storage on simple pages. Served at /hikari/;
	LuCI stays installed for everything else.
endef

# The web app is built with Node (npm run package) before the OpenWrt build,
# because the build machine can't be assumed to have Node. This checks the
# build output is there instead of shipping an empty UI.
define Build/Prepare
	@if [ ! -f ./files/www/hikari/index.html ]; then \
		echo "hikari-ui: run 'npm run package' in the repository first" >&2; \
		exit 1; \
	fi
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/www/hikari
	$(CP) ./files/www/hikari/. $(1)/www/hikari/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/hikari-ui.json $(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/50-hikari-ui $(1)/etc/uci-defaults/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
