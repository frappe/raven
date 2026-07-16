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
   notifications).
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
    HTML fixed padding across the whole app at once.
12. **Keyboard choreography.** The message box sits above the home indicator when
    the keyboard is closed and flush against the keyboard when open. And on iOS,
    the keyboard only appears if you focus a text field *during* the user's tap —
    focus it a moment later (after an await, say) and nothing happens. Every
    "focus the composer" call in the app is written with that constraint in mind.
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

24. **Proper icons and manifest** — square, maskable icons so no platform crops
    or letterboxes them; correct theme color; installable manifest.
25. **Real iOS launch screens** for every device size, so the app opens onto a
    branded splash instead of a white flash.
26. **Instant channel opens** — pointing at (or touching) a channel in the
    sidebar quietly pre-loads its messages, with unread channels loading more
    eagerly. Pre-loading pauses while you're scrolling the list so a fast scroll
    doesn't fire a burst of requests.
27. **A floating date pill** that appears while you scroll and fades when you
    stop, replacing a pile of sticky date headers.
28. **Haptic ticks** at gesture commit points — small, but it's half of why
    gestures feel native.

## What's still on the list

- **Full offline mode**: storing messages themselves on-device, so channels open
  with content even with no connection at all — then syncing differences when
  back online. (Much of the machinery above — the catch-up counters, the
  outboxes — was deliberately built to slot into this.)
- **Permanent message links** that work for any message anywhere, including
  thread replies.
- **Rendering optimizations** for very busy channels (only re-drawing rows that
  changed).
- **Link and document previews** that load lazily as they scroll into view.
- **Live-updating threads list.**
