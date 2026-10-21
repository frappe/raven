#!/usr/bin/env bash
# Builds the signed Android app bundle for Google Play: `yarn native:playstore` from the repo root.
# The version code is shared with iOS and bumped by testflight.sh; this script leaves it alone.
set -euo pipefail

cd "$(dirname "$0")/.."
[[ -f android/keystore.properties ]] || { echo "android/keystore.properties is missing; the bundle would be unsigned." >&2; exit 1; }

# Gradle's toolchain check wants JDK 21. Android Studio ships one.
STUDIO_JDK="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
[[ -d "$STUDIO_JDK" ]] && export JAVA_HOME="$STUDIO_JDK"

# Machine-local files set aside for the build and put back on any exit, as testflight.sh does.
aside=$(mktemp -d)
local_files=(../web/.env.local ../web/.env.native.local capacitor.config.local.json)
restore() { for f in "${local_files[@]}"; do [[ -f "$aside/$(basename "$f")" ]] && mv "$aside/$(basename "$f")" "$f"; done; rmdir "$aside" 2>/dev/null || true; }
trap restore EXIT
for f in "${local_files[@]}"; do [[ -f "$f" ]] && mv "$f" "$aside/"; done

(cd ../web && yarn build:native)
npx cap sync android

# A dev override in the synced config means the local file leaked; stop before bundling.
if grep -q "allowMixedContent\": true" android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
	echo "allowMixedContent is on in the synced config; not bundling." >&2
	exit 1
fi

(cd android && ./gradlew bundleRelease -q)
version=$(grep -m1 -o 'versionName "[0-9.]*"' android/app/build.gradle | grep -o '[0-9.]*')
code=$(grep -m1 -o 'versionCode [0-9]*' android/app/build.gradle | grep -o '[0-9]*$')
mkdir -p release
cp android/app/build/outputs/bundle/release/app-release.aab "release/Raven-$version-$code.aab"
echo "Bundled $version ($code) at release/Raven-$version-$code.aab"
