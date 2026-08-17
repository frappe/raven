# Raven v3 — what it took to make a web app feel like a native app

Notes for a blog post. Each item: what we did, and the non-obvious reason why.

## Navigation that feels native

1. **Pages stack on top of each other instead of replacing each other.** On a
   phone, when you open a channel, the channel list doesn't go away — it stays
   fully alive underneath, and the channel slides in as a layer on top. Going back
   (button or swipe) just removes the layer, revealing the list exactly as you
   left it — same scroll position, instantly. Why this matters: during the iOS
   back-swipe, the system shows a *screenshot* of the previous page while you
   drag, then swaps in the real page. If the real page has to rebuild itself in
   that moment, you see a flash. Keeping it alive means there's nothing to
   rebuild. Bonus: we got scroll restoration for free and deleted the code that
   used to handle it.
2. **Covered pages are switched off for keyboards and screen readers.** A page
   that's hidden under another layer is still in the document — so without care,
   pressing Tab or using a screen reader could land you inside a page you can't
   see. A single HTML attribute (`inert`) on the covered layer prevents that.
   Invisible work, but it's the difference between "looks right" and "is right".
3. **Animate the way in, never the way out.** Opening a page slides it in
   (220ms, with the same easing curve iOS uses). But we never animate going
   *back* — the operating system already animates the back-swipe with its
   screenshot trick, and adding our own exit animation on top produces a double
   animation. On desktop we removed transitions entirely: with a mouse, any
   delay between click and result reads as lag, not polish.
4. **The tab bar is real, and pages slide over it.** Our bottom tab bar used to
   be "floating" — fixed to the screen with an invisible spacer holding room for
   it. The spacer's guess at the bar's height was a few pixels off, so every
   list was subtly cut off at the bottom. Worse: we *removed* the bar when a
   chat opened, which resized the list underneath and made the browser silently
   lose your scroll position — but only if you were at the very bottom, which
   made it maddening to reproduce. Now the bar is a normal part of the layout
   (its space is always exactly its size), it never unmounts, and opening a chat
   slides the page *over* it — exactly how native apps treat their tab bars.
5. **Making the back gesture work when there's no "back".** If you open the app
   by tapping a push notification, you land directly on a chat — and the browser
   history is empty. The back button can be taught a fallback, but the iOS
   back-swipe is literally "browser back", and with no history it does nothing.
   The fix: the moment we detect this cold landing, we quietly rewrite the
   history — put the appropriate list page underneath, and the chat on top.
   Nothing changes on screen, but now the swipe has somewhere to go. Each kind of
   page declares its natural parent (a channel's is the channel list, a thread's
   is the threads page, anything opened from notifications goes back to
   notifications). One honest limitation: when a push notification *cold-starts*
   the app, iOS creates the window with a blank page underneath it, at the
   operating-system level — below anything we can rewrite. A swipe can still
   reach that blank page. We tried routing cold opens through the app's home
   page to bury it; on real devices iOS slid straight past our repair onto the
   blank page anyway, so we reverted. Retested Aug 2026 with a freshly
   reinstalled PWA (ruling out a stale install's captured default URL): same
   result — the gesture reaches the blank page no matter what URL the worker
   opens or what history we synthesize. This matches WebKit bug 268797 (the
   openWindow'd app carries a stale about:blank window client; open since iOS
   16.4). The remaining path is Declarative Web Push (iOS 18.4+), where the
   SYSTEM performs the notification's navigation and no worker-created window
   ever exists — blocked for now on the Raven Cloud relay's payload contract,
   which v2 clients share. Filed under "the platform always gets the last
   word".
6. **Panels behave differently per device — on purpose.** On desktop, opening the
   members panel and switching channels keeps it open when you return: it's a
   workspace, panels are furniture. On mobile the same panel is a bottom sheet,
   and a sheet that pops back open on its own when you revisit a channel feels
   haunted — so on mobile, leaving a channel dismisses its sheets for good.

## Gestures

7. **Swipe to reply — and all the judgment calls inside it.** The row follows
   your finger (capped, with a reply icon fading in behind it) and commits when
   you release past a threshold — or when you *flick*, because a natural quick
   swipe lifts off long before the distance threshold and feels broken without
   velocity detection. A swipe that starts moving vertically is a scroll, and we
   stand down instantly. A swipe starting within ~32px of the left screen edge is
   never ours — that zone belongs to the iOS back gesture, and before we reserved
   it, going back was a game of pixel-perfect precision. Swipes starting inside
   horizontally scrollable content (code blocks, photo albums) belong to that
   content. And a small haptic tick confirms the moment your swipe crosses the
   commit line.
8. **Long-press that tells you what you're pressing.** iOS gives web apps no
   long-press event, so we built one: touch down starts a timer; moving your
   finger (a scroll) or lifting early cancels it. After 150ms of holding still,
   the message under your finger visibly darkens — "this is the one" — and at
   450ms the action sheet opens. The 150ms delay is the trick borrowed from
   iOS itself: it's long enough that scroll flicks and quick taps never trigger
   the highlight, short enough to feel immediate when you're deliberately
   holding.
9. **Double-tap to react** with your chosen emoji — guarded so tapping a link
   twice doesn't also fling a 👍 at it.
10. **Media behaves like users expect**: swipe down on a full-screen image to
    close it, pinch to zoom.

## Fitting a real phone

11. **Respecting the notch and the home indicator.** Modern iPhones reserve
    screen zones for the system, and the browser tells you their size — but
    only if you opt in with one `viewport-fit=cover` tag. We'd been *using* those
    measurements all over the app while the opt-in was missing, so they silently
    measured zero, and lists ended underneath the home indicator. One line in the
    HTML fixed padding across the whole app at once. Android needs the opposite
    care: it reports those measurements as *zero* (content doesn't extend under
    its navigation bar), so padding that was "the system inset" on iOS was
    nothing at all on Android and the composer sat flush against the screen
    edge. The fix is a floor: `max(system inset, 12px)` — iOS keeps its 34px,
    Android gets breathing room.
12. **Keyboard choreography.** The message box sits above the home indicator when
    the keyboard is closed and snug against the keyboard when open. On iOS,
    the keyboard only appears if you focus a text field *during* the user's tap —
    focus it a moment later (after an await, say) and nothing happens. Every
    "focus the composer" call in the app is written with that constraint in mind.
    Android has its own trap: since Chrome 108, the keyboard *overlays* the page
    instead of resizing it, and Chrome only promises to scroll the text caret
    into view — so as our message box grew to multiple lines, its send button
    slid underneath the keyboard. One viewport property
    (`interactive-widget=resizes-content`) restores the old behavior: the page
    shrinks, the layout tracks the keyboard, and the composer grows *upward*.
    iOS ignores the property entirely, which for once is what we wanted.
13. **Edge-to-edge where it should be.** Message rows and content cards drop
    their rounded corners and shadows on mobile — a full-width phone layout with
    desktop card styling looks like a website pretending.
14. **Layers can't bleed through each other.** A subtle CSS fact: an element's
    z-index can make it paint on top of things *outside* its own container. Our
    "New messages" divider had a leftover z-index from an old design and
    literally showed through the thread screen that covered it. Instead of hunting
    such cases one by one, every content card now declares itself an isolated
    stacking context — CSS's way of saying "nothing inside me may paint outside
    of me". A whole class of bugs, closed.

## Working offline (and on terrible connections)

15. **The app shell loads without a network.** All the code and styles are cached
    by a service worker on first visit, so a re-open on the subway still draws
    the app instantly. (One wrinkle: our HTML is generated per-user by the
    server, so we cache a rendered copy of it too — but only for installed
    app users, and we skip caching the ~3MB of iOS splash images the system
    fetches on its own.)
16. **Messages you send are never lost.** Every send is written to on-device
    storage *before* it goes to the server. Kill the app mid-send, lose signal,
    refresh the page — the message survives and is re-sent automatically when
    you're back online. The server recognizes retries by an ID the client
    generates, so a message can never arrive twice. Failures the app can't fix
    by retrying (you were removed from the channel) stop retrying and wait for
    you to decide; everything queued expires after 7 days, because a week-late
    auto-sent message is worse than a lost one. And when a whole batch fails
    offline, you get failed-message bubbles, not a pile of error toasts.
17. **Your reading position is never lost either.** "Which message have I read
    up to" is what unread badges are computed from. That report used to fail
    silently on bad connections, leaving phantom unread badges — sometimes on
    your *own* messages. It now queues on-device just like unsent messages and
    replays when you reconnect. Replaying is always safe because the server
    refuses to move your reading position backwards.
18. **Catching the updates you missed while your phone was locked.** iOS freezes
    a backgrounded web app within seconds and kills its live connection — and
    any reaction, edit, or delete that happens during that gap simply never
    arrives. You can't ask "anything new since X?" because a reaction doesn't
    create anything new — it changes a message you already have. So the app keeps
    a counter of connection breaks, remembers per channel when it last got fresh
    data, and quietly re-fetches anything suspicious — the channel you're looking
    at immediately on unlock, others when you next open them. When the connection
    never broke, all of this costs zero requests.
19. **Detecting the zombie connection.** After waking, iOS's socket often *looks*
    connected for several more seconds while being dead. Every time the app
    regains focus, it checks the connection for real and force-reconnects a dead
    one — that reconnect is also what triggers the catch-up above.

## Notifications done right

20. **Notifications that clean up after themselves.** Every notification is
    tagged with its channel. When you read the channel — on any device — the
    app checks the notification tray and closes anything whose channel is no
    longer unread. No more walking through stale notifications that you already
    read on your laptop.
21. **An accurate app-icon badge**, driven by the real unread counts and cleared
    when you're caught up.
22. **Tapping a notification lands you on the exact message**, centered and
    highlighted — with the back gesture repaired (see #5) so you're never
    stranded there.
23. **Push without page-level Firebase.** Notifications are rendered by the
    service worker from data-only payloads — a lesson from v2, where in-page
    handling leaked duplicate notifications.

## The details people feel but don't notice

24. **Proper icons and manifest — with three lessons the hard way.** First:
    icon paths in a manifest resolve relative to the *manifest's URL*, not the
    page's. Ours pointed at a folder that didn't exist, every icon 404'd, and
    Chrome silently downgraded "Install app" to a plain bookmark shortcut —
    no error anywhere. Second: Android doesn't accept custom splash images at
    all (those `apple-touch-startup-image` tags are iOS-only); it *generates*
    the splash from your manifest's icon, name, and background color — so a
    broken icon also means a broken splash. Third: maskable icons (the ones
    Android crops into circles and squircles) need their background to match
    the splash background color, or the splash shows a visible box around your
    logo instead of a floating glyph.
25. **The status bar is an app decision, not a platform accident.** Android
    paints the system status bar from a `theme-color` meta tag — which we had
    hardcoded to one dark color while the app has light and dark themes. The
    fix is two meta tags — one for light system theme, one for dark — so the
    very first paint is right before any JavaScript runs, plus
    the theme switcher rewriting them with the app's real surface color on
    every theme change — read from the design tokens, so future palette changes
    can't drift. (iOS ignores all of this in installed apps and simply shows
    the page's own background under the status bar — which is why iOS looked
    right while Android didn't.)
26. **Real iOS launch screens** for every device size, so the app opens onto a
    branded splash instead of a white flash.
27. **Instant channel opens** — pointing at (or touching) a channel in the
    sidebar quietly pre-loads its messages, with unread channels loading more
    eagerly. Pre-loading pauses while you're scrolling the list so a fast scroll
    doesn't fire a burst of requests.
28. **A floating date pill** that appears while you scroll and fades when you
    stop, replacing a pile of sticky date headers.
29. **Haptic ticks** at gesture commit points — small, but it's half of why
    gestures feel native. The set keeps growing as gestures do: the newest is
    the image viewer's zoom settling back to fit — pinch out, the image snaps
    to 1x, the chrome fades back in, and the tick lands in the same instant,
    so all three read as one physical event. The recurring implementation
    detail: the tick must fire on the *transition* into the boundary, never on
    mount — an effect that watches "am I at fit" also runs when the image
    simply opens, and a guard on the previous value is what keeps opening a
    photo from buzzing. (Android only, like all our haptics — iOS Safari has
    no Vibration API.)
30. **The service worker that broke image caching — and then fixed it.** A
    surprise from Safari: once a page is controlled by a service worker,
    requests the worker doesn't answer get *worse* HTTP caching — Safari
    re-downloaded every avatar on every channel switch, on requests the browser
    used to serve from disk. Since we can't opt individual images out of the
    worker, the fix was to lean in: the worker now answers image requests
    itself, cache-first. Two separate caches on purpose — avatars (tiny, reused
    constantly, kept ~90 days) and message photos (huge, rarely revisited, kept
    ~30 days) — because one shared cache let a photo-heavy channel scroll evict
    every avatar. Uploaded files never change under a URL (an edit makes a new
    URL), so cache-first can't show stale images; the expiry is garbage
    collection, not freshness. Both caches are wiped on logout — private images
    must not outlive the session on a shared machine. Bonus: images you've seen
    now work offline.
31. **Emoji with no strings attached.** Our emoji pickers and reaction pills
    were rendering Apple-style emoji *images*, fetched one PNG at a time from a
    public CDN — blocked on many corporate networks (and in China), dead
    offline, and a privacy leak (every emoji told a third party your IP). And we
    couldn't fix it by hosting the images ourselves: Apple's emoji artwork is
    copyrighted, and shipping it inside our product is a legal risk that the
    third-party CDN had quietly been hiding. The fix was to stop using images
    entirely: the platform's own emoji font renders everything, matches the
    emoji in message text (which was already native), costs zero requests, and
    works offline. The lesson: if a design choice needs a CDN, ask what happens
    on networks that hate CDNs.
32. **The drawer that haunted the back-swipe.** The workspace switcher is a
    bottom sheet; tapping an unread channel in it navigates to that channel.
    Then, swiping back, the sheet appeared *still open* for a moment — even
    though the app had long since closed it. The culprit is the screenshot trick
    from #1, biting instead of helping: the system's back-gesture animation
    replays a screenshot of the previous page *taken at the moment you navigated
    away* — and at that moment, the sheet was still on screen (its closing
    animation had barely started). Nothing in the live app was wrong; the ghost
    lived in the operating system's photo of the past. Our first fix followed
    the diagnosis with frame-level precision: remove the sheet instantly, let
    the browser paint one clean frame, then navigate. Correct on paper — and it
    still ghosted on a real iPhone. The catch: those frame guarantees are about
    *our* process, and iOS composites frames and records its screenshot in a
    *different* process, on its own schedule. You cannot win a timing race
    against a clock you can't see. The fix that held: navigate only when the
    sheet's closing animation has finished — several hundred milliseconds of
    sheet-free frames that no cross-process lag can outrun. The cost is honest
    and visible (the tap waits out the close animation) instead of hidden and
    racy — and then we made the wait *work for its living*: the tap starts
    fetching the channel's messages immediately, so the download runs behind
    the closing animation, and by the time navigation fires the channel usually
    opens already rendered. The same half-second that used to end on a loading
    skeleton now ends on finished messages — which reads as *faster* than the
    instant navigation ever did.

    Two refinements landed later. First: not every tap needs the wait.
    Switching *workspaces* from the same sheet navigates instantly — the
    destination is the very list page the sheet is sitting on (the layout and
    footer stay mounted across the switch), so the sheet just finishes closing
    over the new workspace's list. The ghost risk still exists in theory, but
    back-swiping between workspace lists is a rare gesture; back-swiping out
    of a just-opened channel is constant. Pay the cost where the gesture
    actually happens. Second: the same bug was hiding in the *create channel*
    sheet, which navigated to the new channel the instant the server confirmed
    it — under the still-open sheet. Same trap, same fix: mobile now waits for
    the sheet to close before navigating (desktop keeps the instant hop, since
    its dialog floats over the channel rather than covering it). Once a rule
    like this exists, audit every drawer that navigates — the second offender
    is always somewhere.

    That audit eventually happened in full, and the second offender was five
    offenders: the command palette (every selection — channels, DMs,
    new-DM-then-navigate, both search rows), "create thread" in the message
    action sheet (which navigated whenever the server answered, racing the
    sheet's close), and the members sheet's "Message" button. The mechanism
    now lives in one hook — `useNavigateFromDrawer`: close the drawer, wait
    out its exit animation on mobile, then navigate; instant on desktop. It
    also accepts a *promise* of a destination, so a server round-trip can run
    during the close animation instead of after it — the same overlap trick
    as the prefetch. One judgment call per flow: "create thread" uses the
    overlap (the action sheet closes on every tap by idiom, so there is
    nothing to hold open), but the DM flows wait for the server FIRST — the
    palette or member list stays open with its spinner, and only a
    successful resolve closes and navigates, so a failure leaves you where
    you were instead of on the page with nothing but a toast. The two
    original hand-rolled fixes were folded into it, and the rule is now one
    sentence: a drawer that navigates, navigates through the hook.

    Three lessons: anything visible around the
    instant of navigation can be frozen into the back-swipe; when you're racing
    another process's clock, don't cut it fine — buy margin you can see; and
    when a delay is forced on you, overlap it with work the user was about to
    wait for anyway.
33. **One character in the manifest decided when the browser bar appears.** An
    installed Android PWA shows a browser toolbar (X, refresh, the URL) whenever
    the current page falls outside the manifest's declared `scope` — that's how
    Chrome marks "you've left the app". Our scope was `/raven/`, with a trailing
    slash — and scope matching is a dumb string-prefix check on the path. The
    app's own home URL is `/raven`, *without* the slash — which does not start
    with `/raven/` — so sitting on the home page counted as having left the app,
    and the toolbar flickered in and out as you navigated. The fix was deleting
    one character: scope `/raven` matches both forms. The kicker: v2 never had
    this bug because its config was *more* wrong — its start URL sat outside its
    own declared scope, which per spec makes the browser throw the scope away
    entirely and treat the whole site as the app. An invalid config that
    accidentally looked correct, hiding the trap for the valid one.
    Epilogue (Aug 2026): the start_url had its own slash problem — it was
    `/raven/`, and PRODUCTION 301-redirects that form to `/raven` (the dev
    bench serves both, which hid it). So every cold launch on prod paid a
    redirect, and any browser logic that compares URLs against the app's
    "default URL" (e.g. WebKit's notification-open window matching) was
    comparing against a moving target. start_url is now `/raven`, matching
    the scope and the canonical route. Installed apps pick the change up on
    their next manifest refresh; a reinstall applies it immediately.
34. **The long-press that fired twice — but only on some Androids.** Holding a
    reaction pill opens "who reacted". Holding a message opens the action
    sheet. On certain Android phones, holding a pill opened *both* — stacked
    on top of each other. The reason: a long-press on Android exists twice.
    We detect it ourselves with a timer (because iOS gives web apps no
    long-press event at all — see #8), but Android *also* fires its own native
    long-press event (`contextmenu`), on its own schedule, typically ~50ms
    after our timer — and the exact delay varies by manufacturer, which is why
    only some phones showed it. Our pill swallowed the first signal but let
    the second bubble up to the message row, which treats `contextmenu` as
    its long-press trigger (that part is deliberate — it's how right-click
    works on desktop). One hold, two independent signals, two drawers. The
    fix: pills simply have no context menu at all — the native signal is
    swallowed unconditionally. We first tried suppressing it only while our
    own timer was mid-hold, preserving desktop right-click on pills — but that
    guard quietly assumed the manufacturer's timing, the exact thing that
    varied. Giving up a right-click nobody needs (the rest of the message is
    the right-click target) bought a fix with no timing assumptions left. The
    lesson: on the web, a "gesture" is often several platform events wearing a
    trench coat, and each one needs an answer.
35. **The app that loaded perfectly and showed nothing — skeletons forever.**
    An offline-capable shell has a dark side: the app can *render* flawlessly
    from cache while every actual request fails — expired login session, dead
    network, either one. Some Android phones would open to an eternal skeleton
    screen, and refreshing didn't help (the shell comes from cache; the
    requests still fail). Two fixes, both smaller than the investigation.
    First: the give-up was self-inflicted. Our data library (SWR) retries
    failures forever with growing gaps — *by default*. A config line we'd
    carried along capped it at 2 retries, so a flaky cold start gave up within
    seconds and nothing ever tried again. Deleting that line restored the
    self-healing we thought we had to build. Second: expired sessions needed
    an exit. v2 solved this by asking the server "am I logged in?" on every
    single boot — a blocking round-trip every open, and exactly what an
    offline-first app can't afford. The trick that made it free: when a
    session expires, Frappe's *failing response itself* rewrites the readable
    `user_id` cookie to "Guest". So on any request error, we just read that
    cookie — no extra request, no guessing — and if it says Guest, we send the
    user to login (and back to where they were, after). Optimistic boot,
    event-driven correction. The lesson twice over: before building recovery
    machinery, check whether you disabled the built-in kind — and when the
    server already tells you the answer on the way down, you don't need to
    call back and ask.
36. **Never autofocus an input on mobile.** On desktop, autofocusing the
    obvious field (a search box, a dialog's first input) is a courtesy — the
    keyboard is already on the desk. On a phone the same line of code is a
    takeover: the on-screen keyboard slams up over half the viewport before
    the user has even read what the screen says, shoving the layout around in
    the process. And on iOS it's worse than rude — it's broken: iOS only
    raises the keyboard for a focus that happens *inside a user's tap* (see
    the keyboard choreography item above), so an autofocus on mount silently
    half-fails, leaving a blinking cursor in a field with no keyboard — a
    state that looks like a bug because it is one. So the rule is
    platform-split: autofocus is desktop-only; on mobile, a field focuses when
    the user taps it, and the keyboard's arrival is always something the user
    asked for. (The exception that proves the rule: the composer focuses after
    actions that ARE a request to type — tapping reply, tapping edit — and
    those are wired synchronously through the tap so iOS cooperates.)
37. **The camera button that only photographed on iPhones.** The composer's
    Camera tile is a hidden file input with the `capture` attribute — the
    web's way of saying "open the camera, not the photo picker". It worked on
    iOS and silently didn't on Android: users got the photo library instead.
    The catch is in how the two platforms read the SAME attributes. Our input
    accepted both images and videos (`accept="image/*,video/*"`), and iOS is
    happy with that — its camera UI has photo and video modes built in, so
    one input covers both. Android, though, must translate `capture` into ONE
    specific camera intent — photograph or record, it has to pick — and when
    the accept list names both, Chrome resolves the ambiguity by silently
    dropping `capture` altogether. No error, no warning: the camera button
    just quietly becomes a gallery button, on one platform only. The fix is a
    platform split: iOS keeps its single Camera tile; Android gets two —
    Camera and Video — each with a single-type accept, so each resolves to a
    clean camera intent. The lesson: `capture` is a REQUEST, not a command,
    and each platform honors it under different conditions — when a native
    integration silently degrades, diff the exact attribute combination
    against each platform's rules before suspecting your own code.
38. **A search list that re-filters must also re-scroll.** In the command
    menu (⌘K), scroll down through some results, then keep typing — and the
    new best match was invisible. The library re-filters on every keystroke
    and even *selects* the first result for you, but it leaves the scroll
    offset wherever you parked it, so the selection sat above the fold:
    pressing Enter would activate something you couldn't see. The fix is one
    line — snap the list back to the top whenever the query changes — and it
    is safe to do in the input handler, before the re-filter even runs,
    because "the top" is the top no matter what the list becomes. This one
    isn't a PWA quirk, just quality: any UI that changes a list *underneath*
    an existing scroll position owes the user a decision about where that
    scroll should land, and "wherever it happened to be" is almost never the
    answer.
39. **The icon that wouldn't line up with wrapping text.** The mention warning
    banner above the composer — the amber strip that says "Jane is on leave
    today" or "The following people aren't in this channel: …" with a little
    palm/info icon in front — is an icon next to text that *wraps* on mobile.
    Every obvious alignment is wrong in one direction. `items-center` centers
    the icon against the whole text block: perfect for one line, but the
    moment the sentence wraps to three lines the icon drifts to the vertical
    middle of the paragraph. `items-start` pins it to the top instead — and
    now it sits visibly *above* the text, because text doesn't start at the
    top of its line box: there's half-leading (the line-height's breathing
    room) above the glyphs, and the icon doesn't know about it. The fix uses
    a CSS unit built for exactly this: `lh`, "one line-height of this
    element". Keep the row `items-start`, wrap the icon in a flex box that is
    exactly one line tall (`h-lh`), and center the icon *inside that box*.
    The icon lands on the first line's optical center — the same place
    `items-center` would put it for a single line — and stays there no
    matter how many lines the text wraps to. Bonus: it's measured from the
    live line-height, so if the type token ever changes size, the alignment
    follows for free, with no magic 1-pixel margin to rediscover. This one
    is pure quality, and it generalizes: every icon-beside-wrapping-text row
    in the app (error banners, empty states, list bullets) is the same three
    classes.
40. **The drop zone that flickered — but only in Safari.** Drag a file over
    the chat and an overlay invites you to drop it. In Chrome: rock solid.
    In Safari: the overlay strobed on and off as you moved the file across
    the messages. The code looked correct — show on `dragover`, hide on
    `dragleave`, but only when `relatedTarget` (the element the drag moved
    *to*) is outside the pane, the standard way to ignore all the
    enter/leave noise from crossing child elements. The catch: WebKit never
    fills in `relatedTarget` on drag events — a years-old bug — so in
    Safari that check read every hop between two message rows as "the drag
    left the pane". Hide; the very next `dragover` shows it again;
    hide/show at drag-event frequency. The fix drops `relatedTarget`
    entirely for a depth counter: every element the drag crosses fires a
    dragenter/dragleave *pair* that bubbles up, so increment on enter,
    decrement on leave, and hide only at zero — child crossings cancel out
    arithmetically, no browser field required. Two lessons: when a DOM
    event field is optional, some browser somewhere leaves it empty, and a
    heuristic built on it will fail only there — and "works in Chrome" is
    the start of cross-browser testing, not the end. Count things you
    control instead of trusting fields you don't.
41. **The back-swipe that navigated underneath an open photo.** Open an image
    in the full-screen viewer on Android and swipe from the screen edge: the
    *page* went back — channel to channel list — while the photo stayed open
    on top, now floating over the wrong screen. The cause is structural: the
    viewer is a global overlay driven by app state, not a route, so it isn't
    in the browser's history — and Android's edge-swipe is an OS gesture the
    web cannot intercept, block, or even see coming. The only thing that
    gesture does is press Back, which means history is the only language you
    can answer it in. So the viewer now speaks it: opening pushes a *sentinel*
    history entry (same URL — the router just re-renders in place), the back
    gesture pops the sentinel, and a popstate listener closes the viewer.
    Page stays put. One subtlety earns its comment: closing through the UI
    instead — the ×, Escape, swipe-down — must *consume* the sentinel with a
    silent `history.back()`, or the next real back gesture would need two
    presses to do anything, which feels exactly as broken as the original
    bug. Bonus: the same fix makes the browser Back button close the viewer
    on desktop and iOS — the standard lightbox contract — for free. The
    lesson generalizes to every state-driven overlay: if it covers the
    screen, the system back gesture belongs to it, and the only way to claim
    that gesture is to put yourself in history.
    A hard-won addendum, found weeks later as a mystery regression: the
    sentinel entry must *carry the router's own state forward* —
    `pushState({ ...history.state, ourFlag: true })`, never a fresh object.
    React Router keeps its position counter (`idx`) inside `history.state`,
    and a sentinel that replaces the state wholesale erases it. That stays
    invisible until some overlay *navigates from* the sentinel entry — pick
    a workspace from the switcher, jump via the command menu — at which
    point the router computes the next entry's counter from a missing one,
    writes `null`, and every later "is there in-app history to pop to?"
    check silently fails: mobile back chevrons stopped popping and started
    jumping to their fallback routes, and the cold-start stack repair
    synthesized wrong entries under warm pages. The failure was three
    screens and one workspace switch away from the line that caused it.
    Spreading the existing state costs nothing and is schema-agnostic —
    whatever the router stores, it keeps.
42. **Tap the photo, the chrome gets out of the way.** The full-screen image
    viewer now works like iOS Photos on mobile: tap the picture and the
    header and filmstrip fade away for distraction-free viewing; tap again
    and they return. Two design decisions carry it. First, the chrome is an
    *overlay* — absolutely positioned over the media area, not rows above
    and below it — so hiding it is an opacity fade, never a relayout of the
    bars themselves. (How the *photo* responds to the toggle turned out to
    deserve a redesign of its own — that story is the next item.)
    Second, the tap had to negotiate with its neighbors: a single tap waits a
    ~250ms beat so a second tap can turn the pair into a double-tap zoom
    instead, and a click whose pointer travelled is the tail of a pan, not a
    tap at all. The gotcha inside that negotiation: you cannot build the
    double-tap on the browser's `dblclick` event — touch double-taps don't
    fire it everywhere (Chrome's device emulation never does; each tap
    arrives as an ordinary click), so the pairing is done by hand from two
    clean taps landing close together in time and place. Same family as the
    Safari `relatedTarget` lesson a few items up: an event you don't get on
    every platform is not a foundation, it's a convenience. And because the
    header holds real actions (download, share, close), the chrome starts
    visible on every open, hiding is only ever something the user did, and
    paging to a video or file — attachments that need their buttons — brings
    it back automatically.
43. **Contained like iOS: the photo lives between the bars, not under them.**
    The chrome-as-overlay from the last item had a flaw you only see with a
    tall screenshot: the image ran the full screen height, straight under the
    header and filmstrip, and the bars became unreadable over its content.
    Watching what iOS Photos actually does revealed a sharper model. A *wide*
    photo takes the full width and does not move at all when the chrome
    toggles — it never intersected the bars to begin with. A *tall* photo is
    held to the space between the bars while they show, and expands to the
    full screen (with a very subtle bounce) when they hide. The first attempt
    copied the obvious mechanic — pad the media area by the bar heights — and
    was wrong in a way worth remembering: the header and filmstrip are
    different heights, so the padded box's center is not the screen's center,
    and every image sat visibly off-center and *shifted* on each toggle. The
    model that works keeps the photo centered on the true screen always and
    instead shrinks the media box's *height*, symmetrically, by the taller
    bar plus a small gutter on both ends. Symmetry is the entire trick: the
    center never moves, so wide images stay pixel-still through the toggle,
    tall ones expand in place — and a bottom band is reserved even when
    there's no filmstrip, for free, because the taller bar (the header) sets
    the reserve on both sides. The bounce is one overshoot cubic-bezier on
    the height transition; no animation library. Two refinements rode along.
    The tap grammar became state-aware: while the chrome shows, tapping the
    dark area around the photo closes the viewer and tapping the photo hides
    the chrome; while it's hidden, the whole screen is "the photo" and a tap
    anywhere just brings the chrome back. And a mystery worth its lesson:
    tall images played an uninvited *opening* animation — because the bars
    were measured after first paint (and reset to zero while the closed
    dialog had them unmounted), every open started at full height and slid
    down to contained once the real numbers arrived. Measure in a layout
    effect, before paint, and keep the last known measurement while the bars
    are away — a CSS transition turns any late measurement into an animation
    you didn't ask for. The mobile zoom pill is gone too: pinch and
    double-tap cover zooming, iOS shows no zoom UI, and on a phone the pill
    was permanent noise floating over the photo (desktop keeps it, hover-
    revealed, where precise stepping and the % readout earn their place).
44. **Two PWAs, one origin: an invalid scope silently claims the whole site.**
    Frappe sites often host several installable apps on one domain — Raven at
    `/raven`, Frappe HR at `/hrms`. Users installed both on Android and then
    reported two baffling symptoms: tapping the Raven app sometimes opened HR,
    and Raven's push notifications showed HR's icon and name. The cause was a
    single line in HR's manifest: `"scope": "/assets/hrms/frontend/"` — the
    build tool had derived the scope from its asset directory. Per the spec, a
    scope that doesn't contain `start_url` is *invalid and silently ignored*,
    and the fallback is the directory of `start_url` — for `/hrms`, that's
    `/`. So HR's installed app quietly claimed the entire origin. Android's
    WebAPK model attributes everything by scope: links under `/raven` fell
    inside HR's effective `/` and could launch HR's app, and — the part
    nobody guesses — **notifications follow scope too**: Chrome badges a web
    notification with whichever installed app's scope contains the service
    worker's scope, so Raven's SW at `/raven/` presented as HR. Three
    lessons. First, on a shared origin every manifest needs an explicit,
    *valid*, mutually exclusive scope — and scope matching is a raw
    path-prefix string comparison, so use a trailing slash (`/raven/`, not
    `/raven`, which would also claim `/ravenanything`). Second, set an
    explicit `id` and then never change it — it's the app's permanent
    identity, and editing it orphans existing installs (we hardened our scope
    but deliberately left `id` untouched). Third, manifest fixes don't
    propagate on your schedule: Chrome re-mints WebAPKs lazily, so the
    deterministic cure for affected users is uninstall + reinstall — and
    `chrome://webapks` on the device shows every installed app's true scope,
    which turns this whole class of bug from a mystery into a one-line read.
45. **The iOS status bar colors itself by looking at your pixels — and no meta
    tag overrides its eyes.** Our toasts appear at the top of the screen on
    mobile, and every time one arrived on iOS, the system status bar briefly
    flipped its look. First theory: the toast *slides in* from off-screen,
    passing under the status bar — so we rebuilt the entry as a fade-in-place
    that never crosses the top edge. No change. The real mechanism: in an
    installed app with `viewport-fit=cover`, the status bar strip isn't
    painted from your `theme-color` — it's effectively transparent, showing
    the page's actual rendered pixels, and iOS continuously re-derives the
    bar's appearance by *sampling the content near the top of the viewport*.
    `theme-color` seeds the base (we declare it, media-queried per scheme,
    and update it from the theme provider), but live sampling adjusts on top
    of it. A near-black card materializing near the top changes the sampled
    result — presence triggers the flip, not motion, so no animation can
    prevent it. We reverted to the default slide-in and accepted the blink.
    The only genuine fix is an opaque "shim" strip pinned above everything at
    `height: env(safe-area-inset-top)`, so the sampled pixels never change —
    rejected deliberately: it taxes every full-bleed surface (the photo
    viewer *wants* to render under the status bar) with a coupling they must
    all remember. The lesson is a sharper version of an old one: on iOS, the
    chrome around your app is a mirror, not a setting. You influence it by
    what you draw, and some flickers are the honest cost of drawing near it.
46. **Bands across a white photo while panning — the GPU showing you its
    tiles.** Zoom into an image in the viewer on a phone and drag it around:
    on busy photos everything looks fine, but on a flat white image, faint
    bands crawl across the picture as you pan. The mechanism is rasterization,
    not layout: the image moves via `transform: translate(...) scale(...)`,
    but nothing promoted it to its own compositor layer — so instead of
    sliding a cached texture, mobile WebKit *re-rasterizes the scaled image
    every frame, tile by tile*, mid-gesture. Adjacent tiles get sampled at
    fractionally different offsets, and the seams between them differ by a
    hair of brightness. A photo's texture hides that hair; a flat white
    surface is a precision instrument for displaying it. (Desktop GPUs
    re-raster fast enough that you never catch the tiles mid-update — which
    is why the bug report says "on mobile".) The fix is one property:
    `will-change: transform` promotes the image to a compositor layer, and
    panning becomes a pure texture transform with nothing to re-rasterize.
    The trade-off to know about: during a pinch the browser samples the
    cached texture, so the image can look slightly soft mid-gesture and
    sharpens on release — the same behavior as native photo viewers. The
    general lesson: content that animates via transforms every frame should
    live on its own layer, and flat, bright test images are worth keeping
    around — they reveal compositor artifacts that real photos camouflage.

47. **A notification click gets three chances to land.** Tap a notification
    while the app is open but backgrounded, and the app should open that
    conversation. Sounds like one line of code; on a phone it fails three
    different ways. The service worker's first move is to message the page
    with the target URL — but a backgrounded iOS PWA has its JS frozen, and
    a message sent into a frozen page is simply lost. So the worker also
    writes the URL down, and the page asks for it when it wakes up. But
    "writes it down" has a trap of its own: a variable in the worker dies
    with the worker, and the OS routinely kills the worker in the seconds it
    takes the frozen page to thaw — so the note goes into Cache API storage,
    which outlives it. And even then there's a race: sometimes the page
    wakes and asks *before* the worker has finished writing. So an
    empty-handed first ask looks once more a moment later. Three paths for
    one click — each one exists because we watched the previous one fail on
    a real device. None of them is removable.

48. **Read notifications sweep themselves out of the tray — if you sweep at
    the right moments.** Open a channel and its system notifications should
    disappear. The sweep ran whenever an unread count changed — which sounds
    complete, until you notice that push is SLOW: the socket delivers a
    message instantly, the push notification arrives seconds later. Read
    the message in those seconds (you were already in the channel), and the
    notification lands in the tray AFTER the last unread change — and
    nothing ever sweeps again. So the worker now pings the page right after
    showing any notification ("sweep now"), which kills an already-stale
    notification within milliseconds of it appearing. And because a frozen
    phone misses that ping, the app also sweeps every time it becomes
    visible — the catch-all that reconciles the tray on every return. The
    lesson generalizes: a cleanup that runs "on change" misses everything
    that arrives after the last change.

49. **The users whose notifications quietly died — for being active.** Reports
    came in: some users get notifications for a while, then nothing. The
    mechanism is Apple's anti-spam rule: a push that doesn't SHOW a
    notification is a "silent push", and after a few of those, the
    subscription is revoked — permanently, without telling anyone. Our
    handler had four paths that ended without showing anything, and the
    worst was the most well-intentioned: "the app is visible, the socket
    already showed this message in-app, skip the system notification." On
    Chrome that's good manners (Firebase's own worker does it). On iOS,
    every one of those skips was a strike — so the users who used the app
    the MOST accumulated strikes the fastest, got revoked, went silent
    until their next launch re-registered them, and then the cycle
    restarted. Now the worker never ends an Apple push without showing
    something: the in-app case shows anyway (the read-sweep clears it
    within moments), and unreadable payloads get a generic fallback. A
    `pushsubscriptionchange` handler also tells any open page to
    re-register on the spot when the browser swaps the subscription.
    The lesson: platform politeness rules differ so much that identical
    code is a courtesy on one platform and self-destruction on another.

50. **The toggle that switched itself off.** Users reported the "push
    notifications" toggle flipping back to disabled on its own, seemingly
    after updates. The toggle's source of truth is simple: is the push token
    stored on this device. And startup had a cleanup that read "if
    notification permission isn't granted, delete the token — it's dead."
    Reasonable — except iOS has a bug where a window opened from a
    notification tap MISREPORTS the permission as "default" even though it's
    granted. So: tap a notification while the app is closed, the app boots
    in a lying window, the cleanup wipes the token, and the toggle reads
    disabled from then on. One tap, permanent-looking damage — and it got
    blamed on updates because updates are when people tap notifications and
    relaunch. The fix is about ambiguity, not iOS: "denied" is an explicit
    user decision and still deletes; "default" is ambiguous (revoked? or a
    platform lie?), so now it just skips the refresh for that launch and
    keeps the token. The lesson: never let a destructive cleanup key off a
    reading that has a known lying state — destroy only on unambiguous
    signals.

## What's still on the list

- **Full offline mode**: storing messages themselves on-device, so channels open
  with content even with no connection at all — then syncing differences when
  back online. (Much of the machinery above — the catch-up counters, the
  outboxes, the image caches — was deliberately built to slot into this.)
- **Offline attachments**: queueing a photo you attached while offline, not
  just the text.
- **Document previews** (Frappe document links unfurling in chat) and the
  generic link-preview card for arbitrary websites. Provider embeds (YouTube,
  Spotify, meeting links…) and previews for links to Raven's own messages,
  channels and threads have shipped.
- **Rendering optimizations** for very busy channels (only re-drawing rows that
  changed).
- **A hero transition for the photo viewer**: the picture growing from the
  tapped thumbnail into the lightbox and shrinking back on close, iOS-style,
  via the View Transitions API (today's fade stays as the fallback for
  browsers without it).
