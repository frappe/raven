# @raven/native

Capacitor project for the Raven iOS and Android apps. The web content is a
native-mode build of `apps/web` (`VITE_NATIVE=1`, output `apps/web/dist-native`),
served from the app's own origin (`https://localhost` on Android, `capacitor://localhost`
on iOS) and working offline. The app talks to the chosen site with OAuth bearers; the
site's CORS hook allows those two origins. Design:
`docs/superpowers/specs/2026-09-09-native-bundled-design.md`.

## Build & run

```bash
yarn native:build     # apps/web native build → apps/web/dist-native
yarn native:sync      # build + cap sync
yarn native:ios       # cap open → Xcode
yarn native:android   # cap open → Android Studio
cd apps/native && npx cap run android --target <serial or avd>
cd apps/native/ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination id=<udid> -allowProvisioningUpdates build
xcrun devicectl device install app --device <udid> <DerivedData>/Build/Products/Debug-iphoneos/App.app
xcrun devicectl device process launch --device <udid> raven.thecommit.company
```

Gates for the page: `cd apps/web && yarn tsc -b && yarn vitest run src/native`.

## Local files (gitignored)

- `android/app/google-services.json`, `ios/App/App/GoogleService-Info.plist`: Firebase.
- `android/local.properties`: SDK path.
- `capacitor.config.local.json`: dev overrides, e.g. `android.allowMixedContent: true` so
  the WebView can call a plain-http bench. Never `androidScheme: "http"`: the site's CORS
  hook allows `https://localhost` only.
- Debug builds allow cleartext for the native HTTP stack too
  (`android/app/src/debug/AndroidManifest.xml`), so downloads and the media proxy reach a
  plain-http bench. Release builds do not.

## Native sources

- Android: `MainActivity` (plugin registration, the media interceptor, inset publishing,
  theme canvas, launch-intent replay guard), `RavenApplication` (night mode, notification
  channel), `RavenShellPlugin` (foreground notifications, share-out chooser, share intake),
  `ShareOut`, `ConversationNotification`, `RavenSocketPlugin`, `RavenDownloadPlugin`,
  `RavenMediaPlugin` + `RavenMediaHandler`.
- iOS: `RavenBridgeViewController` (plugin registration, the media scheme, canvas),
  `SceneDelegate` (theme, share extension handoff), `AppDelegate` (APNs token),
  `RavenShellPlugin`, `RavenSocketPlugin`, `RavenDownloadPlugin`, `RavenMediaPlugin` +
  `RavenMediaHandler`, and the `RavenShare` extension target.
- Page side: `apps/web/src/native/`. Everything outside that directory reaches it behind
  `import.meta.env.VITE_NATIVE` with a dynamic import, so browser builds carry none of it.
  Plugin contracts live next to their callers (`shell.ts`, `download.ts`, `media.ts`,
  `nativeSocket.ts`); `platform.ts` holds the shared helpers (`nativePlugin`, `withPrefs`,
  `listenNative`).

## Sites and sign-in

- A site is added by origin; the app calls `raven.api.raven_mobile.get_client_id` (guest),
  the endpoint the React Native app used, so every 3.0.0 site passes. A site without an
  OAuth client that lists `raven.thecommit.company://oauth` is refused with a message for
  its admin.
- Sign-in is OAuth PKCE in the system browser (`@capacitor/browser`); tokens live in the
  keychain per site (`raven.tokens.<origin>`) and are refreshed at 80% of their lifetime
  and once more on a 401. A refresh the site refuses (`invalid_grant`, revoked client) ends
  the session: the tokens are dropped and the picker signs the same site in again on its
  own (`pendingRelogin`). A refresh that cannot reach the site keeps the stale tokens and
  retries every 30 s.
- Removing a site in the picker forgets everything local first and at once: its tokens, its
  record, its scoped `localStorage` keys, its database and the media cache (shared, so all
  of it goes; `wipeSiteData`). The push unsubscribe and the token revokes then run unawaited,
  so a site that has stopped answering never holds the picker. The bearer goes only to the
  active site's origin (`siteFetch`), never to an absolute URL elsewhere.
- Nothing is backed up or transferred to another phone (`allowBackup="false"` plus
  `data_extraction_rules.xml`): the stored tokens are encrypted with a device-bound key, and
  a copy on another device could not be read.
- API calls use the sdk with a bearer token; the site allows the app's origins through
  `raven.api.native.set_cors` (`before_request`), so sites need no CORS configuration. The
  app sends `X-Raven-App` on every request and the hook requires it: a browser page at
  `https://localhost` shares the Android app's origin but cannot add that header. A site
  whose own config sets `allow_cors` answers before the hook and is not covered by it.
- Set up once per site (Raven Settings → OAuth Client):
  `bench --site <site> execute raven.api.raven_mobile.create_oauth_client`.
- Local bench: add `http://10.0.2.2:8004` on the emulator, `http://127.0.0.1:8004` on the
  simulator (ATS exception in `Info.plist`); the site's `developer_mode` allows the
  `http://localhost` origin.

## Version policy

Any site with the native API opens, whatever its version. The site's `raven_version` is compared with the version the
bundle was built from (`__RAVEN_VERSION__`, read from `raven/__init__.py` at build): a
different patch is silent; a different minor or major opens with a warning toast naming
both versions. `min_app_version` from the site only drives an "update the app"
toast, never a block. Both notices are queued in Preferences by the picker
(`pendingNotice`) and shown once the app is up.

A site older than the mobile API (no `get_client_id`) is refused with "runs an older
Raven". A 3.0.0 site passes the picker but still needs this branch's server side to open:
`raven.api.native.boot` for the session data, and `set_cors` for the app's origins.
Opening such sites in a bridge-less native WebView screen is planned (spec, layer 7).

A site row shows a favicon the site set for itself (`use_website_favicon` in Raven
Settings, a public file), and nothing otherwise: Raven's own artwork is the app's logo.

## The app on a site

- `src/lib/site.ts` holds the active site: `siteUrl` for site-relative paths, `siteKey` and
  `siteStorage` for per-site localStorage, `siteFetch` for fetches with the bearer token,
  `siteToken` for plugins. In the browser all of them are the identity.
- Boot comes from `raven.api.native.boot` (`src/native/appBoot.ts`) and the last good copy
  is kept per site for offline starts. The current user comes from boot through
  `src/lib/sessionUser.ts`, which replaces the Frappe cookies.
- `boot.tsx` imports nothing from the app statically: the store and database modules
  read the site-scoped keys when they load, so they are imported only after
  `setActiveSite`.
- The emoji data file is bundled (`dist-native/emojis.json`); the site's `/assets` are
  served without CORS headers. Fonts are bundled too (vite aliases in native mode).
- Switch site and log out live on the Profile page.
- Realtime runs through a native socket.io client (`RavenSocketPlugin`, Java and Swift)
  bridged into the sdk's context (`src/native/nativeSocket.ts`). Frappe's realtime server
  only accepts a socket whose `Origin` is the site and calls the site back on that origin,
  which a WebView cannot send; the native client sets `Origin`, `Authorization`, and
  `X-Frappe-Site-Name` itself. `VITE_SOCKET_PORT` applies to plain-http benches only.
- Local bench on the emulator: `adb reverse tcp:8004 tcp:8004` and `tcp:9004`, then add the
  site as `http://127.0.0.1:8004`. The socket server calls the site back on the origin the
  client sends: `10.0.2.2` is not routable from the host, and the bench's Node resolves
  `localhost` to `::1`, where nothing listens.

## Error screens

`loadBoot` reports why boot failed and `boot.tsx` acts on it (`BootErrorScreen.tsx`):

- `connecting`: not a failure. Boot waits on the network before anything renders: the token
  refresh, the boot request and the status fallback each give up after 8 s. When boot runs
  past 6 s, `boot.tsx` shows "Connecting to <host>" with Switch site, so a site that does not
  answer never leaves a screen with nothing to tap. The real result replaces it.
- `offline`: no answer, no cached boot, and the device has no network. "You're offline",
  Retry, Switch site; reloads by itself when the network returns.
- `unreachable`: no answer, no cached boot, device online. "<host> isn't responding", it may be down
  or its address may have changed. Retry, Switch site.
- `maintenance` (503): "<host> is under maintenance", Retry, Switch site. A site that
  allows reads during maintenance answers normally and never reaches this screen.
- `unavailable` (any other failure): "Couldn't load Raven", Retry, Switch site.
- `unauthorized` (401, 403): the session is dead; the app returns to the picker, which
  opens the browser login for the same site without a tap.

An HTTP answer is never papered over by the cached boot; only a request that got no
answer falls back to it. A site in maintenance answers its 503 before its CORS hook runs,
so the page's fetch throws on it; `loadBoot` then reads the status once more through
`CapacitorHttp`, which has no CORS, to tell maintenance and a dead session from a site
that is down.

## Offline

- Data at rest is kept only in the native app and an installed PWA (`offlineCacheEnabled`).
- Per site: a Dexie database named by the site origin (users, outboxes, and the newest 20
  messages of every visited channel or thread, written through from the message store),
  plus the persisted SWR cache (channel list, workspaces, unread counts, profile) written
  shortly after every change.
- An offline cold start renders boot, the workspace, channels, unread counts, and the
  cached messages; sends queue in the outbox and flush on reconnect; the cached windows
  are never stamped fresh, so the freshness counter refetches them on reconnect.
- Offline signal (`src/stores/connectionState.ts`, `src/native/reachability.ts`):
  `navigator.onLine` only covers a device with no network. Native adds the site: while the
  socket is down (a disconnect, or a first connect that takes more than 10 s) a ping to the
  site decides, every 15 s, and a failed ping marks the site unreachable after a 5 s
  debounce. Realtime being down alone never reads as offline. Coming back bumps the
  freshness counter, so views that failed while offline refetch themselves. The banner, the
  pagination guard, and the static edge rows read `isOnline()`. Browser code never calls
  `setSiteReachable`, so it is unchanged there.
- A view that failed to load while offline (messages, threads, notifications) shows
  `OfflineState` in native, a calm "You're offline" with no retry, and reloads on reconnect.

## Native integrations

- Push (`push.ts`): one FCM device token, subscribed per site with that site's bearer
  (`environment: "Mobile"`), stored site-scoped and mirrored in Preferences under
  `pushToken.<origin>` so removing a site in the picker can unsubscribe it. Foreground
  pushes are handed to the page (`presentationOptions: []`); ones from another saved site
  are re-posted through `RavenShell.showNotification`. A tap on the open site's push
  navigates; on another saved site it sets the default site, stores the path
  (`pendingPath`), and reloads. The read sweep reads tray entries through the plugin, keyed
  `<hostname>:<channel_id>`.
- Share-in (`shareIn.ts`, `shareIntent.ts`): Android through `RavenShell.getShareIntent`,
  iOS through send-intent's share extension. A non-http url is a file whatever the MIME
  type says (a shared `.txt` arrives as `text/plain`). Delivered to `/share-target?native=1`
  on the active site; a share that opens the picker waits until a site opens. Files are read
  through the WebView's file route (`Capacitor.convertFileSrc`) as Blobs and queued for the
  composer.
- Share-out (`share.ts`, `download.ts`): `RavenDownload` streams the file natively with the
  bearer into `media/<hash>/<file>` (see the media proxy), with progress and cancel from the
  common `DownloadToast`, then hands it to the share sheet. A file the proxy already cached
  opens the sheet at once. Android uses `RavenShell.share` (a plain chooser, Raven
  excluded): the Share plugin waits for the chooser's result, and a pick of Raven itself
  relaunches the singleTask activity over the chooser, leaving the plugin "in progress"
  until a restart. Native labels the actions "Share".
- Share in, Android: the sending app picks the URI, so `RavenShellPlugin` accepts only a
  `content://` URI owned by another app. A `file://` URI or the app's own provider would
  make Raven read its private files on the sender's behalf.
- Orientation: phones are portrait only (manifest `screenOrientation`, iPhone list in
  `Info.plist`). iPhone plays a fullscreen video in a window of its own, which
  `AppDelegate` lets rotate. Android's WebView cannot turn the screen by itself, so a
  fullscreen video stays portrait there. Tablets are not locked: Apple requires every
  orientation on iPad, and Android 16 ignores the lock on screens 600dp and wider.
- Attach on iOS (`pick.ts`): a WKWebView file input always shows iOS's camera / library /
  files chooser, anchored to a composer sheet that has already closed. The Photos and Files
  tiles call `@capawesome/capacitor-file-picker` instead: `pickMedia` with transcoding on
  (JPEG and H.264 copies) or `pickFiles`. The picks are read like shared files. Android and
  the web keep their inputs.
- Links (`links.ts`): the site's own `/raven/…` links route in the app; any other URL keeps
  Capacitor's default and opens in the system browser.
- Android back (`back.ts`): a root page (footer tab or workspace home) goes to the picker
  with the session kept; deeper pages go one step back.
- `NativeBridge.tsx`, mounted from `AppListeners`, registers the listeners that need the
  router; the flows themselves live in their modules.
- Haptics, badge, drawer, theme: the existing hooks branch to the plugins.

iOS share-in is the `RavenShare` extension target (`ios/App/RavenShare/`): it copies each
shared item into the app group `group.raven.thecommit.company` and opens
`raven://?title&description&type&url`, which `SceneDelegate.receiveShare` turns into
send-intent's `sendIntentReceived` event. Both targets carry the app group entitlement;
automatic signing registers it on the App IDs on first build.

## Media proxy

An `<img>` or `<video>` cannot send the bearer, and on hosted sites even a fetch of
`/private/files/` fails: Frappe Cloud's nginx answers the file routes with a fixed
`access-control-allow-origin: <site origin>`, so the app's origin is refused. Private files
therefore load through `RavenMedia` (`src/native/mediaUrl.ts`, `media.ts`):

- URL shape: iOS `raven-media://<folder>/<file>?src=<site url>` (a `WKURLSchemeHandler`);
  Android `https://localhost/_raven_media_/<folder>/<file>?src=<site url>` (answered in
  `shouldInterceptRequest` ahead of Capacitor's local server; Android's WebView drops
  unknown schemes for sub-resources before the client sees them). `useFileSrc` returns it
  for private files in native; public files load straight from the site.
- The handler forwards the request with the bearer, passes `Range` through, and attaches
  the bearer only when `src` is on the session's origin (`setSession` at boot and after
  every refresh). Anything else is answered 403.
- `<folder>` is a hash of the file URL and `<file>` its own name, the same layout
  `download.ts` uses, so a file fetched for viewing serves share-out and the other way
  round. A full (non-Range) 200 is teed into a part file of its own and renamed when
  complete; a complete file answers later requests, Range included, from disk. Range
  answers are streamed only, so a video the WebView fetched by ranges is not cached.
- Media elements only. A top-level load of a proxy URL is answered 403, HTML types are
  served as `text/plain`, and every answer carries `nosniff`: a site file opened as a page
  would run inside the app's WebView with the native bridge.
- Android's WebView applies the request's `Range` to the stream the client returns: it
  skips to the start itself and never stops at the end. `RangeStream` wraps both answers:
  a cached file is returned whole with an end bound, and a 206 body from the site reads
  as the whole resource. iOS answers ranges itself.
- Eviction (`trimMediaCache`, after every message-cache flush, throttled to once a minute,
  and once at boot): the page lists the cache folders of every cached message's file,
  newest message first, and the plugin trims only while the folder exceeds 200 MB: folders
  outside that list go first (oldest first), then the list from its end. The offline
  window keeps its media from the live edge back. The trim runs from a lazily imported
  module because the cache module opens the site-scoped database on load.
- Logout wipes `media/`.

## Insets and keyboard

- The page pads itself with four tokens defined in `index.css`: `--inset-top`, `-bottom`,
  `-left`, `-right`, defaulting to `env(safe-area-inset-*)`. Every inset utility reads them
  (`pt-[var(--inset-top)]` and the like; the `standalone` variant matches installed PWAs
  and `:root.native`).
- Android publishes the system-bar insets into those tokens from `MainActivity`: a
  document-start script (`WebViewCompat.addDocumentStartJavaScript`) so a reload sees them
  before first paint, plus `evaluateJavascript` for the live page, re-run on every inset
  change. The WebView is not padded natively; the status bar is transparent on every
  Android version (`statusBar.ts` only sets the icon style), so the page shows through as
  it does on 15+. Capacitor's own `insetsHandling: "css"` is not usable: its listener
  re-pads the page for the keyboard.
- iOS defines nothing natively; `env()` fills the tokens.
- The offline banner takes the top inset while it shows, so its colour reaches the status
  bar on both platforms.
- Reloads (opening a site, switching, relogin, a push for another site) show no other colour
  on the way: `native.html` sets the theme class before first paint, the same class
  `index.css` reads, so the first frame is already in the app's theme. The canvas behind the
  page shows for a frame too; `RavenShell.applyTheme` re-reads the mirrored theme whenever it
  changes, so that canvas never lags behind until the next launch or resume. The Android WebView
  stays transparent over the theme canvas, and the theme declares transparent bars for
  every window.
- Keyboard: never resizes the page on either platform (iOS `Keyboard.resize: "none"`,
  Android `adjustPan`), matching the installed iOS PWA; the composer lifts by
  `--keyboard-height` (`keyboard.ts`) and the OS pans a covered field into view.

## Release to TestFlight

`yarn native:testflight` from the repo root runs every step below: it bumps the build number,
builds, archives and uploads. `yarn native:testflight --no-upload` stops after the archive and
leaves the build number alone. The steps, for doing it by hand or in Xcode, run from
`apps/native`, on a Mac signed in to Xcode with the team's Apple account. The upload uses the
account's cloud-managed distribution certificate, so no certificate is needed locally.

1. Bump the build number: every `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`
   (four entries, app and share extension), and `versionCode` in `android/app/build.gradle` to
   match. App Store Connect refuses a build number it has seen.

   ```bash
   sed -i '' 's/CURRENT_PROJECT_VERSION = 301;/CURRENT_PROJECT_VERSION = 302;/' ios/App/App.xcodeproj/project.pbxproj
   ```

2. Build the web bundle with the local-only values blanked. Vite reads `.env.local` and
   `.env.native.local` in every mode, so a plain build ships the local socket port and site
   name; real environment variables take precedence over those files.

   ```bash
   (cd ../web && VITE_SOCKET_PORT= VITE_SITE_NAME= yarn build:native)
   ```

3. Sync into the iOS project without the dev override, then put it back.

   ```bash
   mv capacitor.config.local.json /tmp/ 2>/dev/null; npx cap sync ios; mv /tmp/capacitor.config.local.json . 2>/dev/null
   ```

4. Archive, then upload. The upload prints `Upload succeeded` and ends with `EXPORT SUCCEEDED`.

   ```bash
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
     -destination 'generic/platform=iOS' -archivePath release/Raven.xcarchive -allowProvisioningUpdates archive
   xcodebuild -exportArchive -archivePath release/Raven.xcarchive -exportPath release/upload \
     -exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates
   ```

5. In App Store Connect the build appears after processing, usually 10 to 30 minutes, and
   reaches testers without an export compliance question: `Info.plist` declares
   `ITSAppUsesNonExemptEncryption` false, since the app uses standard HTTPS only.

## Before first store submission

The store versions must be higher than the React Native listing (1.1.4); the project
carries 3.0.0 / build 301 (`project.pbxproj`, `android/app/build.gradle`).

- App icons + splash art: done. The splash is black in both themes, with light status bar
  icons over it. Android uses vector drawables built from `raven/public/raven_logo.svg`;
  iOS carries the 1024 icon and one splash image from the same SVG.
- Firebase config files present on the release machine (`google-services.json`,
  `GoogleService-Info.plist`); `capacitor.config.local.json` absent.
- iOS: verify the archived `.ipa` entitlement `aps-environment=production`; Apple Push
  capability on the App ID `raven.thecommit.company`; the `RavenShare` extension in the
  archive with the app group on both targets.
- Android: release keystore generated and referenced; no debug manifest overlay in the
  release APK (cleartext stays off).
- Manual matrix on real devices, both platforms: sign in; push tap cold and warm; share in
  (photo, video, `.txt`, link) and out (image, large file with cancel); private image and
  video on a hosted site; offline banner reaching the status bar; keyboard over the
  composer; a revoked token re-opening the login; site down
  and site in maintenance.
