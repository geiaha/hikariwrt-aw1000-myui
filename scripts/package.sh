#!/bin/sh
# Build the web app and stage it where the OpenWrt package installs from.
set -e
cd "$(dirname "$0")/.."
npm run build
dest=openwrt/hikari-ui/files/www/webui
rm -rf "$dest"
mkdir -p "$dest"
cp -r dist/. "$dest/"
echo "Staged $(du -sh "$dest" | cut -f1) in $dest"
