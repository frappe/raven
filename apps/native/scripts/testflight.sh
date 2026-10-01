#!/usr/bin/env bash
# Builds the iOS app and uploads it to TestFlight: `yarn native:testflight` from the repo root.
# `--no-upload` stops after the archive, with the build number left as it was.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT=ios/App/App.xcodeproj/project.pbxproj
UPLOAD=1
[[ "${1:-}" == "--no-upload" ]] && UPLOAD=0

current=$(grep -m1 -o 'CURRENT_PROJECT_VERSION = [0-9]*' "$PROJECT" | grep -o '[0-9]*$')
version=$(grep -m1 -o 'MARKETING_VERSION = [0-9.]*' "$PROJECT" | grep -o '[0-9.]*$')
if (( UPLOAD )); then
	# App Store Connect refuses a build number it has seen; the app, the share extension and
	# Android move together.
	next=$((current + 1))
	sed -i '' "s/CURRENT_PROJECT_VERSION = $current;/CURRENT_PROJECT_VERSION = $next;/" "$PROJECT"
	sed -i '' "s/versionCode $current\$/versionCode $next/" android/app/build.gradle
	echo "Build $current -> $next"
else
	next=$current
fi

# Machine-local files set aside for the build and put back on any exit: Vite reads .env*.local in
# every mode, and the Capacitor override points the app at a local site.
aside=$(mktemp -d)
local_files=(../web/.env.local ../web/.env.native.local capacitor.config.local.json)
restore() { for f in "${local_files[@]}"; do [[ -f "$aside/$(basename "$f")" ]] && mv "$aside/$(basename "$f")" "$f"; done; rmdir "$aside" 2>/dev/null || true; }
trap restore EXIT
for f in "${local_files[@]}"; do [[ -f "$f" ]] && mv "$f" "$aside/"; done

(cd ../web && yarn build:native)
npx cap sync ios

# Any value from the local env files found in the bundle means it leaked; stop before archiving.
for f in "$aside"/.env*.local; do
	[[ -f "$f" ]] || continue
	while IFS='=' read -r key value; do
		value=${value//[\"\']/}
		[[ ${#value} -ge 4 ]] || continue
		# A value the tracked source also uses, such as the base name, is not local to this machine.
		git grep -qwF -- "$value" -- ../web/src ../../packages && continue
		if grep -rqwF -- "$value" ios/App/App/public; then
			echo "$key from $(basename "$f") is in the bundle; not archiving." >&2
			exit 1
		fi
	done < <(grep -E '^[A-Z_]+=' "$f")
done

rm -rf release
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
	-destination 'generic/platform=iOS' -archivePath release/Raven.xcarchive \
	-allowProvisioningUpdates -quiet archive
echo "Archived $version build $next in release/Raven.xcarchive"

(( UPLOAD )) || exit 0
xcodebuild -exportArchive -archivePath release/Raven.xcarchive -exportPath release/upload \
	-exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates -quiet
echo "Uploaded $version build $next. It appears in App Store Connect after processing."
