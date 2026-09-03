# @raven/native

Capacitor shell for the Raven native apps (iOS + Android).

## Overview

The shell bundles only a site picker. It navigates the WebView to
`https://<site>/raven`; `server.allowNavigation: ["*"]` injects the Capacitor
bridge there. The web app (`apps/web/src/native/`) does all plugin calls.

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
- Android: `POST_NOTIFICATIONS` permission.
- Android: `de.mindlib.sendIntent.SendIntentActivity` with SEND/SEND_MULTIPLE
  filters in AndroidManifest.
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
`clear_sessions` only reads the table — so a kill under a running app looks
like it did nothing.

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
   - (d) The `RavenShare` target + ShareViewController/AppDelegate snippets as
     already written there.
3. Android release signing (keystore) is not in the repo.

## Developing against a local site

Production talks https only; the committed config allows no cleartext. Local
dev overrides live in two gitignored files, absent on CI and fresh checkouts,
so release builds stay locked down:

- `capacitor.config.local.json` — merged into `capacitor.config.ts` at
  `cap sync` time (a warning line is printed when applied):

  ```json
  {
      "server": { "allowNavigation": ["*", "http://10.0.2.2:8004"], "cleartext": true },
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

For a real-https loop with no overrides at all, tunnel the bench:
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

## Android bridge on remote pages

Capacitor 8 registers its bridge script (`addDocumentStartJavaScript`) for the
app origin only, so remote pages would get no `window.Capacitor` on any modern
WebView. `RemoteBridgePlugin` (registered in `MainActivity`) re-registers the
same script for every origin, reaching `Bridge.getJSInjector()` by reflection.
After a Capacitor upgrade, check that `isNativePlatform()` is still true on a
remote page (Chrome DevTools → `chrome://inspect`).

## Known limitations

- If a saved site fails to load on launch, the WebView's error page sits behind the
  splash; the next launch (within 15 s) falls back to the picker with an error line.

- No service worker inside the WebView (push handled natively).
- WebView default error page when a site is down.
- Android WebView persists cookies asynchronously — a kill within seconds of
  login can lose the session (real users unaffected).

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
| Share-out file | | | | |
| Camera tile | | n/a | | |
| Share-in warm start (app already open) | | | | |
| Keyboard inset with composer | | | | |
| Status bar light/dark | | | | |
| Android back: chat → list → picker | n/a | n/a | | |

Note: simulators have no camera — the Camera tile row cannot be exercised on
them.
