#!/bin/sh
# Build and copy the UI straight onto a router for testing, without an ipk:
#   ROUTER=root@192.168.88.1 npm run deploy
# Replaces /www/webui and the ACL file, then reloads rpcd for the ACL.
# Uses tar over ssh because dropbear images often lack sftp for scp.
set -e
cd "$(dirname "$0")/.."
router=${ROUTER:-root@192.168.88.1}
npm run build
tar -C dist -cf - . | ssh "$router" 'rm -rf /www/webui && mkdir -p /www/webui && tar -C /www/webui -xf -'
ssh "$router" 'cat > /usr/share/rpcd/acl.d/hikari-ui.json && /etc/init.d/rpcd reload' \
	< openwrt/hikari-ui/files/usr/share/rpcd/acl.d/hikari-ui.json
# Same front-page redirect the package sets up (see its uci-defaults).
ssh "$router" 'cat > /www/webui-index.html' < openwrt/hikari-ui/files/redirect/webui-index.html
ssh "$router" "uci -q get uhttpd.main.index_page | grep -qw webui-index.html || {
	uci -q delete uhttpd.main.index_page
	for p in webui-index.html index.html index.htm default.html default.htm; do uci -q add_list uhttpd.main.index_page=\$p; done
	uci -q commit uhttpd; /etc/init.d/uhttpd reload; }"
host=${router#*@}
echo "Deployed: http://$host/webui/"
