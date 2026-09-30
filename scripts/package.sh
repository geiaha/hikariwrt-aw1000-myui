#!/bin/sh
# Build the web app and stage it where the OpenWrt package installs from.
# The Android app rides along when it has been built (android/build.sh):
# the router then serves it at /webui/HikariWrt.apk, and the System page
# offers it to Android phones.
set -e
cd "$(dirname "$0")/.."
npm run build
dest=openwrt/hikari-ui/files/www/webui
rm -rf "$dest"
mkdir -p "$dest"
cp -r dist/. "$dest/"
if [ -f android/build/HikariWrt.apk ]; then
	cp android/build/HikariWrt.apk "$dest/"
	echo "Included the Android app ($(du -h android/build/HikariWrt.apk | cut -f1))"
else
	echo "No Android app included (run android/build.sh first to ship it)"
fi
echo "Staged $(du -sh "$dest" | cut -f1) in $dest"
