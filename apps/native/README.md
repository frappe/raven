# @raven/native

Capacitor shell for the Raven native apps (iOS + Android).

## Overview

The shell bundles only a site picker. It navigates the WebView to
`https://<site>/raven`; the Capacitor bridge is injected there and the web app
(`apps/web/src/native/`) does all plugin calls.

`server.allowNavigation: ["*"]` is only there because the saved-site list is
dynamic. The shell's own plugin (`RavenShellPlugin`, iOS + Android) gates every
main-frame http(s) navigation: saved sites and the shell load in the WebView,
anything else opens in the system browser. Never widen that gate — every page
that loads in the WebView gets the full plugin bridge, including the keychain
tokens. Its JS contract lives in `packages/lib/utils/ravenShell.ts`.

## Before first store submission

Checklist — the committed project still carries Capacitor template assets and
the RN listing (1.1.4) must be beaten:

- App icons + splash art: native trees still use Capacitor's template assets —
  plan real artwork before release.
- Versions must exceed the RN listing (1.1.4): set to 2.0.0 / build 200 (done
  in step 4 below).
- Verify the archived .ipa entitlement `aps-environment=production`.
- Apple Push capability on the App ID `raven.thecommit.company`.
- iOS share extension wired (manual step 2).
- Android release keystore generated and referenced (manual step 3).
- Run the manual test matrix below, including Camera, on a real device.

## Prerequisites

- Node / Yarn 1 (monorepo workspaces)
- Xcode + Swift Package Manager (the generated project uses SPM: `ios/App/CapApp-SPM`)
- Android Studio (Android)

## Build & run

```bash
yarn native:build    # vite build of the picker → apps/native/dist
yarn native:sync     # build + cap sync
yarn native:ios      # cap open → Xcode
yarn native:android  # cap open → Android Studio
yarn native:test     # vitest
```

Direct run (device):
```bash
cd apps/native && npx cap run ios --target <udid>
cd apps/native && npx cap run android --target <avd>
```

## What is already wired

Committed native projects already include:

- iOS: `GoogleService-Info.plist` is a member of the Xcode App target.
- iOS: `App.entitlements` (`aps-environment`) via `CODE_SIGN_ENTITLEMENTS`;
  `UIBackgroundModes: remote-notification`.
- Android: `POST_NOTIFICATIONS` and `CAMERA` permissions; iOS: camera and
  microphone usage strings (the composer's capture inputs need both).
- Android: SEND/SEND_MULTIPLE filters on `MainActivity` (`singleTask`), read by
  `RavenShellPlugin` — not send-intent's own `SendIntentActivity`, which is a
  second `BridgeActivity` where the shell plugin would be missing. send-intent
  is still used for the iOS share extension.
- Android: `android/build.gradle` forces `compileSdkVersion 36` on subprojects
  (send-intent@7 targets 35).
- Picker built with `target: es2017` (old Android WebViews reject optional
  chaining).

## OAuth sign-in

The picker signs in through the system browser when the site has an OAuth
client. Tokens live in the iOS/Android keychain (SecureStorage).

- The flow runs in `@capacitor/browser`: `SFSafariViewController` on iOS
  (AutoFill and passkeys work, but Safari's own cookies / SSO sessions are NOT
  shared with the app) and Custom Tabs on Android.
- PKCE (S256) is implemented in the shell itself (`src/pkce.ts`, `src/auth.ts`)
  — no third-party OAuth plugin. The redirect
  `raven.thecommit.company://oauth` is delivered through Capacitor
  `App.appUrlOpen`; token exchange / refresh / revoke run natively via
  `CapacitorHttp`.
- The first sign-in shows Frappe's "Confirm Access" consent page: the client is
  created without `skip_authorization`.
- Keychain items are protected with `afterFirstUnlock`, so they survive an
  encrypted backup.
- Opening a site from the picker goes through `reauth`: a stored refresh token
  is exchanged silently and posted to `login_with_token`; the system browser is
  opened for OAuth only when there is no token. "Switch site" keeps the session,
  tokens and push
  subscription, so coming back is silent too.
- `login_with_token` is a top-level POST. Frappe CSRF-rejects it when the
  WebView still holds a live `sid` for that site, so the shell expires the
  site's cookies (`RavenShell.clearSiteCookies`) right before posting.

Sites running a Raven without `raven.api.native_auth` report no `native_login`
flag from `get_client_id`, so the shell skips OAuth there and uses the site's
web login page inside the WebView instead.

Set up once per site (Raven Settings → OAuth Client):

```bash
bench --site <site> execute raven.api.raven_mobile.create_oauth_client
```

Sites without a client fall back to the in-WebView login page. The web app
uses the shell origin when it needs to return control: on iOS it navigates to
`capacitor://localhost/?relogin=<site origin>&to=<path>` and on Android to
`https://localhost/?relogin=<site origin>&to=<path>`; the same applies for
`?signout=<site origin>`. These are user-visible recoveries, so they bypass the
splash auto-nav. `raven.thecommit.company://oauth` is only the OAuth redirect URI (the RN app's bare `raven.thecommit.company:` loses its query in Foundation's URL parser; re-run `create_oauth_client` on sites provisioned before this change so the client lists both). On Android it is received by `MainActivity`'s VIEW intent-filter (scheme + host, `singleTask` → `appUrlOpen`); on iOS by `CFBundleURLTypes`.

To test silent re-login, quit the app first, then kill the session server-side:
`bench --site <site> execute frappe.sessions.clear_sessions --kwargs '{"user":"<user>","force":True}'`
followed by `bench --site <site> execute frappe.cache.delete_key --args '["session"]'`.
An open app re-saves its session to Redis after the `tabSessions` row is gone
(Frappe `Session.update`), and Redis-only sessions resume indefinitely while
`clear_sessions` only reads the table — so clearing sessions while the app is
open has no effect.

## Manual steps

Not scriptable — do once per environment:

1. Apple developer portal: enable Push Notifications on App ID
   `raven.thecommit.company`; select the signing team in Xcode.
2. iOS share-in: create a Share Extension target named `RavenShare` in Xcode
   with app group `group.raven.thecommit.company`, following the send-intent
   README "iOS" section (`node_modules/send-intent/README.md`):
   - (a) Add a URL scheme `raven` to the main app `Info.plist`
     `CFBundleURLTypes`.
   - (b) Add `com.apple.security.application-groups` =
     `group.raven.thecommit.company` to BOTH `App.entitlements` and the
     extension's entitlements.
   - (c) The `NSExtensionActivationRule` block from the send-intent README
     (lines ~96-113).
   - (d) The `RavenShare` target + ShareViewController snippet as written
     there. Skip its AppDelegate snippet: this app is scene-based, so the
     `raven://` handoff is already handled in `SceneDelegate.swift`
     (`scene(_:openURLContexts:)` fills send-intent's `ShareStore`).
3. Android release signing (keystore) is not in the repo.

## Firebase config files

`android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist`
are gitignored. Download both for the app `raven.thecommit.company` from the
Firebase console (project `raven-c2659`) and put them at those paths. Android
builds without the JSON (the Gradle script skips the google-services plugin and
push stays off); the iOS target lists the plist as a resource, so Xcode fails
until it is present. CI must inject both before building.

## Developing against a local site

Production talks https only; the committed config allows no cleartext. Local
dev overrides live in two gitignored files, absent on CI and fresh checkouts,
so release builds stay locked down:

- `capacitor.config.local.json` — merged into `capacitor.config.ts` at
  `cap sync` time (a warning line is printed when applied):

  ```json
  {
      "server": { "allowNavigation": ["*", "http://10.0.2.2:8004", "http://127.0.0.1:8004"], "cleartext": true },
      "android": { "allowMixedContent": true }
  }
  ```

  `cleartext` lets CapacitorHttp reach an http site, `allowMixedContent` lets
  the WebView navigate to one, and the explicit `http://10.0.2.2:<port>` rule
  is needed because Capacitor turns scheme-less `allowNavigation` entries into
  `https://…` origin rules. Re-run `npx cap sync` after editing. If you build
  a release binary on a machine that has this file, run a sync with the file
  moved aside first — the values are baked into the app at sync time.

On Android, `server.cleartext: true` also makes `cap sync` write
`android:usesCleartextTraffic="true"` into the generated (gitignored)
`capacitor-cordova-android-plugins` manifest, so no manifest edit is needed —
and a sync without the local file removes it again.

The emulator reaches the host at `10.0.2.2`; the iOS simulator uses
`localhost` (`Info.plist` ships `NSAllowsLocalNetworking`, which only relaxes
ATS for local hosts). Use an API 34+ Android image — the stock API 28/30
images ship WebView 66, which cannot run the v3 bundle.

Realtime on the Android emulator: Frappe's socket server resolves the site from
the page's Origin hostname (or `default_site` for `localhost`/`127.0.0.1`), so a
site added as `http://10.0.2.2:8004` connects but is rejected with "Invalid
namespace". Map the host ports into the emulator instead and add the site as
`http://127.0.0.1:8004` — not `localhost`, which Capacitor's asset server
intercepts on every port:
`adb reverse tcp:8004 tcp:8004 && adb reverse tcp:9004 tcp:9004`
(the mapping is dropped by `cap run` and emulator restarts — re-run it). Put
`http://127.0.0.1:8004` in the local override's `allowNavigation` as well. The
iOS simulator already uses `localhost`.

To test over real https with no overrides at all, tunnel the bench:
`cloudflared tunnel --url http://localhost:8004` and add the printed URL in
the picker.

## Release

- iOS: bump `CFBundleShortVersionString` in the Xcode project, then Archive +
  upload.
- Android: bump Android `versionName`, generate a signed APK/AAB and upload.
- Plugin JS in apps/web and plugin native code in the shell are coupled —
  bumping any @capacitor* version in apps/web needs a matching store release.

## iOS back-swipe

`RavenBridgeViewController` (set as the window root in `SceneDelegate.swift`,
subclassing `CAPBridgeViewController`) turns on `allowsBackForwardNavigationGestures` —
WKWebView leaves it off, while installed PWAs get the edge swipe from iOS.
The web app's `useMobileBack` treats it as a normal `history.back()`.

## RavenShell plugin

`apps/native/android/.../RavenShellPlugin.java` and
`apps/native/ios/App/App/RavenShellPlugin.swift`; contract in
`packages/lib/utils/ravenShell.ts`.

- Navigation gate (both): main-frame http(s) loads are allowed only for the
  saved sites (`Preferences` key `sites`) and the shell origin; everything else
  is handed to the system browser. Sub-frames keep Capacitor's default policy.
  Android checks twice — `shouldOverrideUrlLoading` never fires for POSTs, so
  `shouldInterceptRequest` answers a blank 403 for a blocked main-frame POST.
  Origins must match exactly, redirects included, which is why `validateSite`
  saves the origin the site actually answered from (apex → www, http → https).
- Android bridge on the saved sites: Capacitor 8 registers its bridge script
  (`addDocumentStartJavaScript`) for the app origin only, so remote pages would
  get no `window.Capacitor`. The plugin registers the same script for the saved
  site origins (reaching `Bridge.getJSInjector()` by reflection) and re-registers
  on `syncAllowedOrigins()`, which `sites.ts` calls after every save/remove.
  After a Capacitor upgrade, check that `isNativePlatform()` is still true on a
  remote page (Chrome DevTools → `chrome://inspect`). iOS needs nothing: the
  bridge is a `WKUserScript`, which runs on every main-frame document.
- Share intents (Android): `getShareIntent()` reads `MainActivity`'s SEND
  intent (all items of a SEND_MULTIPLE, each `content://` copied into the app
  cache so the stash survives the activity's URI grant), `clearShareIntent()`
  forgets it, and a warm share fires the `shareReceived` event from
  `onNewIntent`. `MainActivity.onCreate` drops a SEND intent that comes back
  with a saved state or `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY` — Android
  re-delivers the task's root intent after process death, which would replay
  an already-sent share. The web app also re-reads on mount and on every
  foreground (iOS keeps a share in send-intent's store until read).
- `clearSiteCookies({ url })`: expires one site's WebView cookies before
  `login_with_token` — host-only and every parent-`Domain` form, since a
  proxy may set `sid` with a Domain attribute.
- Removing a site in the picker unsubscribes its push row (the web app mirrors
  the FCM token per site under `pushToken.<origin>`, sent with the OAuth
  bearer) and revokes its tokens; "Switch site" keeps everything.

Theme changes on Android are applied through `onConfigurationChanged`
(`uiMode` is in `configChanges`); never `recreate()` the activity — a recreate
reloads the WebView from the shell URL and drops the page the user was on.

## Known limitations

- If a saved site fails to load on launch, the WebView's error page sits behind the
  splash; the next launch (within 15 s) falls back to the picker with an error line.

- No service worker inside the WebView (push handled natively).
- WebView default error page when a site is down.
- Android WebView persists cookies asynchronously — a kill within seconds of
  login can lose the session (real users unaffected).
- A site's "Login with Google/GitHub" button (in-WebView login page, sites
  without an OAuth client) leaves the WebView: the provider's page is not a
  saved site, so the gate opens it in the system browser and the session ends
  up there. Provision the OAuth client instead.

## Manual test matrix

| Area | iOS device | iOS sim | Android emu | Android device |
|---|---|---|---|---|
| Add site, login, relaunch keeps session | | | | |
| OAuth sign-in via system browser | | ✅ | ✅ | |
| Silent re-login after server-side session kill | | ✅ | ✅ | |
| Site without OAuth client → login page | | ✅ | ✅ | |
| Sign-out revokes token (OAuth Bearer Token status Revoked) | | ✅ | ✅ | |
| Switch site, re-open without login | | | | |
| Push enable → token row (Mobile) | | n/a | | |
| Push tap: warm, cold, other-site | | n/a | | |
| Badge set/clear | | n/a | | |
| Share-in: url, image, multiple | | | | |
| Share-in with no site saved yet → opens the share target after adding one | | | | |
| Share the same link twice in a row (second one must arrive) | | | | |
| Share, send, kill app, reopen from Recents → no replay (Android) | n/a | n/a | | |
| Share while on the picker / during boot → delivered once a site opens | | | | |
| Add a site that 301s (apex → www) → opens in the WebView, not the browser | | | | |
| Remove site in picker → its pushes stop; tokens revoked | | | | |
| Share-out file | | | | |
| Camera tile | | n/a | | |
| Share-in warm start (app already open) | | | | |
| Message link → opens in system browser, not in the WebView | | | | |
| Consent page "Deny" → picker shows access denied, browser closes | | | | |
| Theme switch in-app, background + resume: page and scroll position kept (Android) | n/a | n/a | | |
| Realtime: message arrives live without reload (socket.io 101 in chrome://inspect) | | | | |
| Keyboard inset with composer | | | | |
| Status bar light/dark | | | | |
| Android back: chat → list → picker | n/a | n/a | | |

Note: simulators have no camera — the Camera tile row cannot be exercised on
them.
