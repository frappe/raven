#!/usr/bin/env bash
# Copies the app version from raven/__init__.py into every other place that holds it:
# the iOS project, the Android build, and the package.json files. Change the version
# in raven/__init__.py only; the release scripts run this before they build.
# `yarn native:version` from the repo root runs it on its own.
# Build numbers are separate: testflight.sh bumps those.
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(grep -m1 -oE '__version__ = "[^"]+"' ../../raven/__init__.py | cut -d'"' -f2)
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "No x.y.z version found in raven/__init__.py." >&2; exit 1; }

# The app target and the share extension each have several build configurations; all of them change.
sed -i '' -E "s/MARKETING_VERSION = [0-9.]+;/MARKETING_VERSION = $version;/g" ios/App/App.xcodeproj/project.pbxproj
sed -i '' -E "s/versionName \"[^\"]+\"/versionName \"$version\"/" android/app/build.gradle
# Only the top-level "version" key: it is the one indented by two spaces.
for file in package.json ../../package.json; do
	sed -i '' -E "s/^  \"version\": \"[^\"]*\"/  \"version\": \"$version\"/" "$file"
done

echo "Version $version set for iOS, Android and package.json"
