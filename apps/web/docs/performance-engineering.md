# Raven v3 — why building a chat app is harder than it looks

Notes for a blog post. This isn't about new features — it's about the invisible
work that makes the app feel fast and never show you wrong data.

## Why chat is hard

A chat app looks simple: a list of messages and a text box. The hard part is that
everything on screen is changing all the time, from four directions at once — you
send a message, someone else sends one, the server responds to something you did
earlier, and your other devices mark things as read. All of that has to land on
screen instantly, in the right order, without ever flickering or showing stale
information.

In most apps, two updates arriving at the same time is a rare accident. In a chat
app it happens constantly. Version 2 handled these collisions case by case as bugs
showed up. For version 3, we changed the approach: find every *kind* of collision,
give it a name, and build a small mechanism that makes it impossible.

## Stop re-rendering the world

The clearest example of what was wrong in v2: when any user changed their status
(say, set themselves to "away"), every message on screen re-rendered. Not because
messages changed — but because everything read from one big shared pool of data,
and React re-renders everything that touches a pool when anything in it changes.

v3 splits that pool into small, focused stores — one for messages, one for users,
one for unread counts, and so on — and components subscribe to exactly the piece
they display. A message row showing Alice's avatar listens to *Alice*, nothing
else. When Alice goes away, her rows update; the other five hundred don't even
notice.

Three quiet rules make this work everywhere:

- **Don't hand out new objects when nothing changed.** If a component asks for the
  same data twice, it gets the *same* object back — that's how React knows it can
  skip the work.
- **When refreshing data from the server, reuse what's unchanged.** If we re-fetch
  50 messages and only one gained a reaction, the other 49 keep their original
  objects — so only one row re-renders.
- **Make every update safe to apply twice, and safe to apply late.** Each message
  carries a "last modified" time, and the store refuses to overwrite newer data
  with older data. That one rule means we never need clever undo logic: if
  something goes wrong, just re-fetch — the store sorts out what's actually newer.

Concrete instances, for the record:

- The stores themselves: per-channel message windows (`channelMessagesStore` —
  a `byId` map + ordered id list per channel), users, unread counts
  (`channelUnreadStore`), presence, channel list (`channelStore`), thread
  metadata, notifications. Each is a plain class with `subscribe(key, listener)`
  — no framework, ~50 lines each.
- **Split hot data from cold data.** A thread's reply count changes constantly
  (every reply); its member list almost never. They used to live in one cache
  entry, so every reply invalidated the members too. v3 keeps them in separate
  stores (`threadMetaStore` vs `channelMembersStore`) — the reply-count event
  patches a number, and the member list doesn't hear about it.
- **Return the previous array when nothing changed.** The channel-members hook
  merges member metadata with user profiles; after the merge it compares the
  result to last time element-by-element and, if identical, returns the *old
  array object* (`useChannelMembers`'s merge cache). Everything downstream that
  memoizes on the array skips.
- The stream's render blocks (`selectStreamBlocks` — messages grouped with date
  dividers, batch grouping, continuation flags) are memoized on the window
  array's identity, so a store write that didn't change this channel recomputes
  nothing.

## Do things once, not once per message

A lot of v2's sluggishness came from doing per-message work that only needed doing
once per screen:

- **Right-click menus.** v2 built a full menu component for every single message —
  hundreds of them, each with its own event listeners. v3 has *one* menu for the
  whole conversation; it figures out which message you clicked from the click
  itself.
- **Looking up who sent each message.** v2 had every row search for its sender
  individually. v3 builds one lookup table when the user list changes, and every
  row reads from it.
- **Channel lists.** The channels sidebar and the DMs list used to share one data
  hook, so a new DM re-rendered the channels list too. Splitting them
  (`useChannels` / `useDMChannels`) means each list only reacts to its own changes.
- **One hover toolbar for the whole stream.** Like the menu: the toolbar that
  appears when you hover a message is a single floating component
  (`MessageHoverToolbar`), repositioned to whichever row the mouse is over — not
  one toolbar per row.
- **One swipe-reply icon for the whole stream.** The little reply glyph that fades
  in behind a dragged row is a single element, parked at the dragged row's edge
  when a swipe starts.
- **List footers must be stable components.** With virtualized lists (Virtuoso),
  passing an inline `{ Footer: () => ... }` creates a brand-new component type
  every render — the list unmounts and remounts the footer each time, re-running
  its data queries. All our list footers are module-level constants (the DM
  sidebar's suggestion footer was the one that taught us).
- **Count the renders a feature costs before shipping it.** The long-press
  highlight is stored globally (any stream can show it), which re-renders the
  stream when set. That's fine *because of frequency*: a tap or scroll costs zero
  renders (the highlight arms only after a 150ms settle, and clearing an
  already-null value is skipped), a deliberate long-press costs exactly two. The
  same audit is why continuous gesture motion never touches state at all.
- **The command menu (⌘K) budget.** Typing used to hit the on-device database on
  every keystroke; now it searches a pre-built in-memory candidate set, capped in
  size, keyed by display names.
- **Even randomness is memoized.** The channel header shows a few member avatars,
  shuffled so it's not always the same alphabetical faces — but the shuffle is
  seeded by the channel id (deterministic), so it doesn't reshuffle on every
  render or every visit.
- **Animations and gestures.** While your finger drags a message (swipe to reply),
  we move the row directly on screen without involving React at all — React only
  hears about it when you let go. Continuous motion is handled by hand; on/off
  state is handled by React. That split is a rule for us now. 
  - What it means. When you drag a message sideways to reply, your finger position updates 60–120 times per second, and the message row has to follow it exactly — any lag and the gesture feels rubbery.

  The "normal" React way to do this would be: on every finger movement, update a piece of state → React re-runs the component → compares the new output to the old → applies the difference to the screen. That whole pipeline, 120 times a second, just to change x by a few pixels. It's a lot of machinery for a tiny change, and on a mid-range phone it drops frames — the row visibly stutters behind your finger.

  So instead, while your finger is down, we bypass React entirely: the touch handler writes the position straight onto the DOM element (row.style.transform = "translateX(37px)"). No state, no re-render, no comparison — one line, one frame, done. React doesn't even know the drag is happening. Only when you lift your finger does React get involved again: "did this commit as a reply or not?" is a real state change, it happens once, and we want React's declarative machinery for what follows (showing the reply banner, focusing the composer).

  The rule we extracted from this: continuous motion is handled by hand, on/off state is handled by React. Anything that changes every frame (drag position, glyph opacity tracking the drag) is a direct style write. Anything that changes once per user decision (highlight on, menu open, reply set) goes through React state. Mixing them up in either direction hurts — per-frame React state stutters, and hand-managed on/off state gets silently wiped whenever React re-renders for its own reasons.

## Give every race condition a name

The heart of the rewrite. Some examples of collisions that used to cause weird,
unreproducible bugs — and the small mechanisms that now prevent them:

- **Two fetches for the same channel, finishing in the wrong order.** Hovering a
  channel pre-loads it; clicking it loads it; tapping a notification loads it
  *centered on a specific message*. If an older request finished last, it would
  overwrite the right result with the wrong one. Now every request takes a ticket
  number, and a response is only used if its ticket is still the newest. Stale
  responses — even their errors — are thrown away.
- **A background load replacing the page you navigated to.** When you tap a
  notification, we jump you to that exact message. While that's happening, the
  channel is "claimed": ordinary loads for it are simply refused, so nothing can
  swap the page out from under you mid-jump.
- **Clicking the same notification twice.** "Scroll to message X" used to be
  stored as just the message ID — so asking for the same message twice looked
  like no change at all, and React ignored it. Now each request is a fresh little
  object with a timestamp, so a repeat click still counts as a new request.
- **Your own message coming back to you.** When you send a message, the server
  broadcasts it to everyone in the channel — including you. Without care, you'd
  see your message twice. And separately: if "you're back online" and "socket
  reconnected" fire at the same moment, you might *send* it twice. These sound
  similar but are different problems, and v2 tangled them together. v3 keeps two
  separate lists — "messages we're waiting to hear back about" and "requests
  currently in flight" — and each check asks the right list.
- **Sending queued messages in parallel.** When the app comes back online with a
  few unsent messages, sending them all at once made the database choke (they all
  write to the same channel row) and let the server order them randomly. They now
  go out strictly one at a time, oldest first.
- **The silent killer: missed events.** Real-time updates only reach you while
  the connection is alive. On a phone, iOS freezes the app seconds after you
  switch away — the connection dies quietly, and any reaction, edit, or delete
  that happens during the gap is just… gone. You can't ask the server "did I miss
  anything newer than X?" because a reaction doesn't create anything new — it
  changes something you already have. The only fix is to *remember that a gap
  happened*. We keep a counter that ticks up every time the connection breaks,
  and every channel remembers the count from when it was last fetched. If the
  numbers don't match, the channel quietly re-fetches next time you look at it.
  While the connection never breaks, all of this costs zero extra requests.
- **A database deadlock we inherited.** In v2, fetching messages *also* wrote
  "user last visited this channel" inside the same database operation. Under
  load, that write collided with people sending messages, and the database
  would occasionally lock up. v3 tracks your reading position on the client
  (only moving forward, sent at most every 1.5 seconds) and reports it
  separately. The server never moves the marker backwards — which also means if
  we have to re-send an old report after being offline, it's harmless.
- **A live event racing its own re-fetch.** A thread's reply count can arrive two
  ways: a push event ("now 5 replies") and a re-fetch after a connection gap. If
  someone replies *while* the re-fetch is in flight, the event (newer) lands
  first and the response (older) lands second — and would overwrite 5 with 4. The
  store timestamps the last event and compares it to when the fetch *started*:
  a response older than the last event is discarded (`threadMetaStore.applyFetched`).
- **A connection break in the middle of a fetch.** When we re-fetch after a gap,
  we stamp the data "fresh as of break #N" — but N is read *before* the request
  goes out. If the connection breaks again mid-flight, the response is stamped
  with the old number and correctly stays suspect. Stamping after the response
  would mark possibly-stale data as fresh.
- **Refreshing a channel without eating the user's scroll position.** The
  quiet re-fetch after a gap replaces the message window — but if you'd scrolled
  150 messages back, a smaller replacement would delete what you're reading and
  yank the view. So the re-fetch asks for the window's size plus headroom (new
  arrivals push the window down), refuses windows too deep to re-cover in one
  request (they reload on next open instead), and stands down entirely while a
  jump-to-message navigation owns the window.
- **Your unsent messages surviving a refresh mid-reload.** When the latest page
  is re-fetched, any optimistic (not-yet-confirmed) messages you sent are
  re-inserted into the fresh window — the server doesn't know about them yet, so
  a plain replace would make your own message vanish for a second
  (`applyInitialPage` keeps them).
- **The menu that selects itself.** Open a context menu near the bottom of the
  screen and the browser shifts it up to fit — landing a menu item under your
  cursor, so releasing the *opening* click "selects" it. Every menu ignores
  selections within 200ms of opening (`OPEN_GESTURE_GUARD_MS`). Same family: the
  click that iOS synthesizes after a long-press is swallowed for a short window —
  a *window*, not a latched flag, because iOS often produces no click at all and
  a latched flag would eat the next real tap.
- **The "New messages" divider's lifecycle.** It freezes where it was when you
  entered (so it doesn't vanish while you're reading), recomputes on a warm
  re-entry, and — after stacked navigation kept channels alive under threads —
  also recomputes when you come back from a thread, since "coming back" no longer
  remounts anything.

## The scroll engine

Chat scrolling is upside-down compared to a normal page: new content appears at
the *bottom*, history loads at the *top*, and the view must never jump while
either happens.

- When older messages load in above, we adjust the scroll position in the same
  breath — the message you were reading doesn't move a pixel. That only works if
  nothing changes height unexpectedly, so loading spinners get fixed-size slots
  and we avoid browser features that estimate sizes and correct them later.
- "Follow the newest message" and "stay on the message you jumped to" fight each
  other. After a jump, the jumped-to message wins for a couple of seconds — so an
  image loading late can't yank you away from it.
- If you scroll deep into history, the view detaches from the live edge — new
  messages don't move you while you're reading. A "jump to present" button brings
  you back.
- Opening a channel with unread messages lands you on the "New messages" divider,
  not the bottom — and the *server* centers the very first fetch on the first
  unread message (`anchor_to_unread`), so it's one request, not a "fetch latest,
  realize we need earlier, fetch again" dance.
- "Auto-scroll when I send a message" only applies at the live edge — the same
  code path fires when older pages append, and without that guard, paginating
  through history occasionally teleported you to the bottom.
- Jump-to-message has a fallback for messages with no DOM node of their own: a
  photo inside a collapsed album can't be scrolled to directly, so each batch row
  lists all its member ids in a data attribute and the scroll engine falls back
  to the containing batch (`data-batch-member`).

## Only fetch what's on screen

A channel where every message has a thread, a poll, or a link preview must not
fire a hundred requests when it opens. Every piece of "extra" data waits until its
message actually scrolls near the viewport, loads once, and then stays current via
live updates. The same gate powers recovery after a connection gap: only the
things you're *looking at* re-check themselves; everything else waits its turn.

The reverse trick also applies: hovering (or touching) a channel in the sidebar
pre-loads its messages, so opening it feels instant — but pre-loading pauses while
you're scrolling the list, so a fast scroll doesn't fire off a dozen requests.
Unread channels pre-load faster than read ones (120ms vs 350ms of hover) — you're
more likely to open them.

More of the same discipline:

- **One request, two stores.** A thread pill's fetch (`get_thread_details`)
  returns both the reply count and the participants; it seeds the count store and
  the members store in one shot, and fires once per thread ever — live events
  keep both current afterwards. Revisiting a channel re-fetches nothing.
- **Batched writes.** Marking notifications read happens when messages scroll
  into view — those are collected and flushed in one call, not one per message.
  The reading-position report debounces 1.5s and force-flushes when you switch
  channels or hide the tab (a pending report must not be lost with the tab).
- **Two freshness strategies for two data shapes.** Cheap "whole truth in one
  call" data (all unread counts, who's online, the channel list) simply
  re-fetches on window focus. Per-channel data (message windows) can't afford
  that — it revalidates only after a detected connection break, and only what's
  actually viewed. Choosing per shape is the whole game.

## Counting things correctly

Two counting rules that sound trivial and weren't:

- **A multi-photo message is one message.** Sending 4 photos with a caption
  stores 5 database rows (they share a batch id). Every counter must collapse
  the batch: the unread badge says 1, the thread pill says "1 reply", and both
  use the same `COUNT(DISTINCT COALESCE(batch_id, name))` idiom server-side. We
  found the thread-reply counter counting rows (a photo-batch reply showed as
  "4 replies") long after the unread counter had it right — consistency between
  counters is its own bug class.
- **Reply counts are cached in Redis, refreshed by events.** Counting a thread's
  replies is a query; doing it on every pill render would hammer the database.
  The count lives in a Redis hash, is recomputed when a message is actually
  added/removed, and the refreshed number rides the same push event that updates
  clients — so the cache, the database, and every screen agree.

And the unread system's semantics, which took several iterations to get right:
system messages ("X joined") never count as unread and the divider never anchors
on them; sending a message marks the channel read instantly on your device (you
are obviously caught up); the channel you're actively looking at — at the bottom,
tab visible — is held at zero, so live messages you're watching arrive never
flash a badge; and the reading position only ever moves forward, so scrolling UP
through history can't mark newer messages as read.

## One bug class you only see in production

Our monorepo could accidentally bundle *two copies* of the same library. Two
copies of React's context system means the app asks copy A for data that copy B
holds — and gets nothing. The cruel part: the development server always picked one
copy, so the bug only existed in production builds. The fix is one build setting
that forces a single copy of the sensitive libraries — but finding it taught us
that duplicate dependencies aren't a bundle-size annoyance, they're a correctness
bug.

## What debugging this taught us

The worst bug of the project: clicking a notification sometimes didn't scroll to
the message. We "fixed" it four times — each fix plausible, each wrong (a fetch
race, a state quirk, a DOM edge case…). What finally worked was giving up on
theories and logging when components mounted and unmounted. The real cause: a tiny
wrapper component that rendered its children one way when enabled and a slightly
different way when disabled. To React, that structural change means "this is a
different tree — throw it away and rebuild", so the *entire chat pane* was being
silently destroyed and recreated, taking the in-progress scroll with it. The fix
was one `return` statement.

Lessons we now treat as rules:

- **Measure before you theorize.** Add logging first; guess second.
- Development mode intentionally double-runs things, so raw logs lie — know what
  "normal" looks like before reading them.
- If a bug only appears after code changes without a full reload, reload first —
  hot-reloading can manufacture ghosts.
- To find out if a piece of code is still used, don't search for its name (names
  repeat) — delete it and let the compiler list every real usage.

## The through-line

Every fix above is the same move: **take something we were silently assuming and
turn it into something the code actually enforces.** "The last response is the
right one" became ticket numbers. "The connection keeps us up to date" became a
break counter. "React won't rebuild this" became a rule about how wrappers must
render. Chat apps are hard because they bill you for every assumption you didn't
know you'd made — v3 is v2 with those assumptions written down as code.
