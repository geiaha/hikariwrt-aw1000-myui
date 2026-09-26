#!/bin/sh
# Build and copy the UI straight onto a router for testing, without an ipk:
#   ROUTER=root@192.168.88.1 npm run deploy
# Replaces /www/hikari and the ACL file, then reloads rpcd for the ACL.
# Uses tar over ssh because dropbear images often lack sftp for scp.
set -e
cd "$(dirname "$0")/.."
router=${ROUTER:-root@192.168.88.1}
npm run build
tar -C dist -cf - . | ssh "$router" 'rm -rf /www/hikari && mkdir -p /www/hikari && tar -C /www/hikari -xf -'
ssh "$router" 'cat > /usr/share/rpcd/acl.d/hikari-ui.json && /etc/init.d/rpcd reload' \
	< openwrt/hikari-ui/files/usr/share/rpcd/acl.d/hikari-ui.json
host=${router#*@}
echo "Deployed: http://$host/hikari/"
