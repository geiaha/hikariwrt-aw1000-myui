#!/bin/sh
# Build android/build/HikariWrt.apk without Gradle, with the SDK's own tools:
#   aapt2 compile + link  resources and manifest -> base APK, and R.java
#   javac                  against android.jar
#   d8                     class files -> classes.dex
#   aapt add               classes.dex into the APK
#   zipalign + apksigner   aligned, signed with the release key
#
# Needs: ANDROID_SDK (default ~/.local/opt/android-sdk) with build-tools and
# the platform below, and a JDK 17+. The release key lives outside the repo
# (KEYSTORE_DIR, default ~/.local/share/hikariwrt-android) and is made on the
# first build. Keep it: an update installs over the app only when it is signed
# with the same key.
set -eu
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-$HOME/.local/opt/android-sdk}
BUILD_TOOLS=${BUILD_TOOLS:-37.0.0}
PLATFORM=${PLATFORM:-android-36}
MIN_SDK=29
TARGET_SDK=36
BT=$SDK/build-tools/$BUILD_TOOLS
JAR=$SDK/platforms/$PLATFORM/android.jar
KEYDIR=${KEYSTORE_DIR:-$HOME/.local/share/hikariwrt-android}
KEYSTORE=$KEYDIR/release.jks
KEYPASS_FILE=$KEYDIR/keystore.pass
OUT=build

for f in "$BT/aapt2" "$BT/d8" "$BT/zipalign" "$BT/apksigner" "$JAR"; do
	[ -e "$f" ] || { echo "missing $f - install build-tools;$BUILD_TOOLS and platforms;$PLATFORM with sdkmanager" >&2; exit 1; }
done

# versionName from the web UI's package.json; versionCode in minutes since the
# epoch, so every build installs over the last one without a counter to keep.
VERSION=$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' ../package.json)
CODE=$(( $(date +%s) / 60 ))

if [ ! -f "$KEYSTORE" ]; then
	mkdir -p "$KEYDIR"
	chmod 700 "$KEYDIR"
	head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$KEYPASS_FILE"
	chmod 600 "$KEYPASS_FILE"
	keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias hikariwrt \
		-keyalg RSA -keysize 4096 -validity 10000 -dname "CN=HikariWrt, O=HikariWrt" \
		-storepass "$(cat "$KEYPASS_FILE")" -keypass "$(cat "$KEYPASS_FILE")" >/dev/null 2>&1
	echo "made a release key: $KEYSTORE (password in $KEYPASS_FILE) - back it up"
fi

rm -rf "$OUT"
mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/res/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest AndroidManifest.xml \
	--java "$OUT/gen" --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
	--version-code "$CODE" --version-name "$VERSION" --auto-add-overlay "$OUT/res/res.zip"

javac --release 17 -nowarn -Xlint:none -encoding UTF-8 -classpath "$JAR" -d "$OUT/classes" \
	$(find src "$OUT/gen" -name '*.java')

"$BT/d8" --release --min-api $MIN_SDK --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/unaligned.apk"
( cd "$OUT/dex" && "$BT/aapt" add ../unaligned.apk classes.dex >/dev/null )
"$BT/zipalign" -p -f 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"
# apksigner's bundled Conscrypt trips a JDK 24+ "restricted method" warning
# on every run; it is harmless, and only that is filtered out.
{ "$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias hikariwrt --ks-pass "file:$KEYPASS_FILE" \
	--out "$OUT/HikariWrt.apk" "$OUT/aligned.apk" 2>&1 1>&3 | grep -v '^WARNING:' >&2 || true; } 3>&1
[ -f "$OUT/HikariWrt.apk" ] || { echo "signing failed" >&2; exit 1; }
rm -f "$OUT/base.apk" "$OUT/unaligned.apk" "$OUT/aligned.apk" "$OUT/HikariWrt.apk.idsig"

echo "built $OUT/HikariWrt.apk ($VERSION, versionCode $CODE, $(du -h "$OUT/HikariWrt.apk" | cut -f1))"
