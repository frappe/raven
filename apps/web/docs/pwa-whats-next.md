# PWA: what's next

The [PWA enhancements doc](./pwa-enhancements.md) is the story of what we already
built. This one looks forward: what Apple and Google have shipped for web apps
recently, and the ideas that could make Raven's PWA even better. Written in
simple terms — each idea says what it is, where it works, and what we'd do
with it.

Support notes are as of mid-2026. "Android" means Chrome on Android; "iOS"
means Safari / home-screen web apps on iOS.

## What Apple shipped recently

Apple spent years being the reason PWAs felt second-class. That has changed
fast:

- **iOS 26: every site added to the home screen now opens as an app by
  default.** No manifest required. Before, a site without the right manifest
  opened as a glorified Safari tab. This is a big distribution win — "Add to
  Home Screen" now always produces something that feels like an app.
- **Declarative Web Push (Safari 18.4).** Push notifications described as
  plain JSON that the OS displays directly — no service worker code has to
  wake up to render them. More battery-friendly and more reliable (nothing to
  crash). Chrome doesn't support it yet.
- **Screen Wake Lock (Safari 18.4).** A web app can ask the screen not to
  sleep. Previously iOS-web had no way to do this.
- **WebTransport (Safari 26.4).** A modern, lower-latency alternative to
  WebSockets. Both major engines now have it.
- **Keyboard Lock (Safari 26.4).** Full-screen apps can capture shortcuts the
  browser normally steals.
- **Better media plumbing (Safari 26).** WebCodecs audio encode/decode,
  lossless audio in MediaRecorder, speaker selection for WebRTC on iOS, and
  writing files straight to disk with streams.

## What Google shipped recently

Chrome has had the richer PWA toolbox for years; the recent work is mostly
about polish and making things standard:

- **Install with just a manifest.** A service worker is no longer required for
  the install prompt. (We have one anyway — offline needs it.)
- **View Transitions are now Baseline.** The API that animates one screen
  into the next (shared-element transitions, like native apps have) works in
  Chrome, Safari, and Firefox for same-document changes.
- **Document Picture-in-Picture.** A floating always-on-top mini window whose
  content is your own HTML, not just a video. Chrome desktop only.
- **Speculation Rules.** Declarative pre-loading/pre-rendering of likely next
  pages. Mostly for multi-page sites — our SPA already does its own prefetch.
- **WebGPU / WebAssembly maturity.** Near-native compute in the browser. Not
  a chat-app need today, but it's why "the web can't do X" keeps aging badly.

## Ideas for Raven

Roughly ordered by how much a chat user would feel them.

1. **Inline reply from a notification.** *(Android)* Notifications can carry
   action buttons, and on Android one of them can be a text field — reply to a
   DM straight from the notification shade without opening the app, like every
   native messenger. The service worker receives the typed text and calls our
   send API. iOS web notifications don't support actions yet, so this would be
   an Android-only delight.

2. **Notification action buttons.** *(Android)* Even without inline reply:
   "Mark as read" and "Mute" buttons on the notification itself. Cheap to add
   once the action-handling plumbing from idea 1 exists.

3. **View Transitions between screens.** *(everywhere)* Animate the channel
   list morphing into the channel, an avatar flying from the sidebar into the
   profile page. We hand-built our page-slide animations with CSS; View
   Transitions could do shared-element morphs those can't. Worth a prototype —
   the API is finally in all three engines.

4. **Declarative Web Push.** *(iOS)* Our push already uses a data-only payload
   that the service worker renders. Declarative push would let iOS show the
   notification even if our service worker is killed or broken — one less
   moving part on the platform where background execution is flakiest. Can be
   layered on: Safari falls back to classic push automatically.

5. **Share message TEXT out of Raven.** *(everywhere)* Sharing already works
   both ways for files: we receive shares (share target), and attachments have
   a Share action that hands the real file to the native share sheet. The one
   sliver left is text — a "Share" action on a text message that passes its
   content to `navigator.share`. Small, since the file plumbing already
   exists.

6. **App shortcuts on the icon.** *(Android + desktop)* A `shortcuts` list in
   the manifest gives long-press-the-app-icon menu items: "Saved messages",
   "Search", top DMs. iOS ignores it, but it's a manifest-only change —
   nearly free.

7. **Voice notes.** *(everywhere)* MediaRecorder is now solid on both
   platforms — Safari 26 even added lossless formats. Record, show a waveform,
   send as a file message. The composer's attachment pipeline already handles
   the upload half.

8. **Wake lock during calls / long media.** *(everywhere, finally)* When we
   build huddles or video playback, ask the screen to stay awake. Two lines
   with the Screen Wake Lock API, and it now works on iOS too.

9. **Floating mini-window for huddles.** *(Chrome desktop)* Document
   Picture-in-Picture could keep a small call window with mute/leave buttons
   on top while the user works elsewhere. The natural companion to any future
   calls feature.

10. **Ask for persistent storage.** *(everywhere)* One call —
    `navigator.storage.persist()` — asks the browser to never evict our
    origin's data under storage pressure. Becomes important the moment the
    IndexedDB offline plan lands: an evicted database is a wiped message
    cache.

11. **Web OTP: auto-filled login codes.** *(Android)* If login ever uses SMS
    codes, the OTP API fills the code from the incoming SMS with one tap. iOS
    does this natively through keyboard suggestions already.

12. **Background Fetch for big files.** *(Android)* Downloads/uploads that
    keep running even if the user closes the app, with an OS progress
    notification. The gap it fills: today a large file upload dies with the
    tab.

13. **Periodic Background Sync.** *(Android)* The browser occasionally wakes
    our service worker to refresh data — unread counts could be warm before
    the user even opens the app. Chrome gates the frequency on how often the
    user actually uses the app.

14. **Auto-away presence via Idle Detection.** *(Android + Chrome desktop)*
    Detect that the user has walked away from the machine and flip presence
    to "away", like Slack desktop. Permission-gated and Chrome-only, so it's
    a progressive enhancement at best.

15. **Contact picker for invites.** *(Android)* "Invite to Raven" could open
    the phone's contact list and pick emails/numbers without us ever seeing
    the whole address book.

16. **Protocol handler: `web+raven://` links.** *(Android + desktop)* Register
    the installed app to open custom links, so integrations or emails can
    deep-link straight into the installed PWA instead of a browser tab.

17. **WebTransport for realtime — someday.** *(everywhere, newly)* Our
    realtime rides on Frappe's socket.io. Now that WebTransport is in both
    engines it's the long-term successor (faster reconnects, no head-of-line
    blocking), but that's a framework-level migration, not an app feature.

## The pattern

Two things repeat across this list. First: **most "native-only" chat features
now have a web API** — inline reply, voice notes, wake lock, PiP, share
sheets. The gap left is genuinely small: no iOS notification actions, no
background execution on iOS, and no web equivalent of a home-screen widget.
Second: **the platforms are converging on the same rule** — everything
works in an installed app, and iOS increasingly treats "added to home screen"
as the real app boundary. Investing in the install experience keeps paying
off.

## Sources

- [WebKit: News from WWDC25 — Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [WebKit Features for Safari 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)
- [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) (Declarative Web Push, Wake Lock)
- [Michael Tsai: Web Apps in iOS 26](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/) (home-screen default change)
- [web.dev: What's new in web (I/O 2025)](https://web.dev/blog/whats-new-in-web-io2025)
- [web.dev: Same-document view transitions are Baseline](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available)
- [Chrome: What's new in view transitions (2025)](https://developer.chrome.com/blog/view-transitions-in-2025)
- [MobiLoud: PWAs on iOS — 2026 guide](https://www.mobiloud.com/blog/progressive-web-apps-ios)
- [MagicBell: PWA iOS limitations & Safari support](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
