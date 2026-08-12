# Link Previews — Architecture & Phased Plan

*Planned August 2026. Supersedes the old "generic OpenGraph card" roadmap item.*

## Why we're rebuilding this

Two problems with the v2 approach, one of them a security problem:

1. **`get_preview_link` is an SSRF surface.** The client hands the server a list of
   URLs and the server fetches them. Any authenticated user can make our server
   issue GET requests to arbitrary destinations. The IP-address regex guard in
   that endpoint only blocks *literal* IP URLs — it does nothing against a
   hostname that resolves to a private range, a redirect into
   `169.254.169.254` (cloud metadata), IPv6 loopback, or DNS rebinding. On
   hosted deployments this is a real target.
2. **Previews aren't durable or searchable.** We want every link stored in the
   database — with its provider (YouTube, X, Reddit, Wikipedia, GitHub, …)
   detected server-side — so the Links search tab can filter by provider and
   previews survive beyond a Redis cache.

## The one rule everything hangs on

> **The server only ever fetches URLs it extracted itself from saved message
> HTML. The client never supplies a URL to fetch.**

This single rule turns preview fetching from "open proxy for arbitrary
requests" into "processing our own data". Every phase below preserves it.

## Decisions already made (and why)

| Decision | Why |
| --- | --- |
| **Enqueue, not `deferred_insert`** | Deferred insert is Redis-buffered write batching for high-volume trivial rows. It delays doc creation until the flush job, risks the buffer on Redis loss, and the network fetch needs an enqueued job anyway. Link-bearing messages are a small fraction of writes — one job per message is nothing. |
| **No Link field from the child table to the preview doc** | The preview doc is created *asynchronously* — it doesn't exist at message-save time, so a Link field would fail link validation (or need `ignore_links` and sit broken). The stored `normalized_url` on the child row is the entire join contract. |
| **`get_messages` does not change at all** | It keeps shipping the raw newline-joined links string. No child rows, no provider, no embedded previews. Embedding previews was rejected (no dedup across messages; the planned IndexedDB message persistence would freeze stale preview blobs inside cached windows). Shipping provider was rejected (the client already derives provider from its own render matchers). |
| **`get_previews` takes RAW urls; the server normalizes** | The URL normalizer then exists in exactly one place. No client copy to drift. Two raw spellings of one canonical URL cost two client store entries sharing one server row — an accepted trade. |
| **Provider in the DB exists purely for search filtering** | Rendering keeps using the client's provider chain (it needs to parse video/tweet ids anyway). The stored provider feeds the FTS index and the Links-tab filter, nothing else. |

---

## Phase 1 — Extraction, detection, and closing the SSRF hole

*No user-visible change. The foundation.* **✅ Shipped (Aug 2026)** —
`raven/links.py` holds the normalizer, provider registry and the
shell-upsert job; tests in `raven/tests/test_message_links.py`. Extra
providers beyond the original list: `Raven Link` (same host, `/raven`
path) vs `Site Document Link` (same host, any other path).

- **Server-side link extraction at message save** (create + edit): parse the
  *stored* Tiptap HTML for hrefs. Never accept a client-provided link list.
- **URL normalization** (server-only function): strip `utm_*`/`fbclid`-class
  tracking params, lowercase the host. Conservative — query params like
  YouTube's `?v=` are load-bearing.
- **Provider detection registry** (pure function, no network): domain + path
  matchers → `youtube | x | instagram | reddit | wikipedia | github | spotify |
  vimeo | loom | soundcloud | apple_music | generic`. Runs at save.
- **Child table rows** (Raven Message Link) store: `url` (raw, as written),
  `normalized_url` (precomputed — protects old rows if the normalizer ever
  changes), `provider`.
- **Kill on-demand fetching**: `get_preview_link` stops fetching. Either delete
  it or reduce it to a read of stored previews only.

**Done when:** every new link-bearing message has child rows with provider set,
and no whitelisted endpoint fetches a client-supplied URL.

## Phase 2 — The fetch pipeline

*Previews start landing in the database.* **✅ Shipped (Aug 2026)** —
`raven/safe_fetch.py` (DNS-pin, per-hop revalidation, size caps),
`raven/link_fetcher.py` (oEmbed / Wikipedia REST / Hacker News API /
OG + JSON-LD / markdown fallback), tests in
`raven/tests/test_link_fetching.py`. Retry backoff is opportunistic
(re-share retries) — scheduled backoff moved to Phase 4.

- **One enqueued job per message** ("process links of message X"): upsert
  `Raven Link Preview` docs by normalized URL (exists-check + unique name
  handles same-URL races; a popular link is fetched once, ever), then fetch.
- **New fields on Raven Link Preview**: `provider`, `status`
  (pending / fetched / failed / blocked), `fetched_at`, `stale_after`,
  `fetch_error`, `image_width` / `image_height` (or an aspect bucket — the
  frontend needs dimensions at first paint for deterministic heights).
- **Per-provider fetch strategies**: oEmbed for YouTube, X
  (publish.twitter.com), Reddit, Vimeo — keyless JSON, far more reliable than
  scraping against bot walls. Wikipedia REST summary API. OG scrape only for
  `generic`. Instagram will fail — store `failed` gracefully, never retry
  forever (bounded retries with backoff, then terminal).
- **`safe_fetch()` — the hardened fetcher every strategy uses**:
  - scheme allowlist (http/https only)
  - resolve DNS, then connect to the **resolved IP** (anti-rebinding),
    rejecting private / reserved / loopback / link-local / metadata ranges
  - re-check **every redirect hop** (`requests` does not do this for you) with
    a redirect cap
  - connect + read timeouts; streamed download with a hard ~2MB cap
  - content-type allowlist; no cookies; fixed UA
  - per-domain and global concurrency caps
- **Realtime completion**: upgrade `link_previews_updated` to carry the
  payload (url + preview fields), published to the channel room.

**Done when:** sending a message with a YouTube/X/Reddit/Wikipedia/generic link
produces a fetched preview doc within seconds, and a hostile URL (redirect to
metadata IP, huge body, slow host) is rejected by `safe_fetch()` tests.

## Phase 3 — Frontend: store, cards, and search filter

*The user-visible payoff.* **Mostly shipped (Aug 2026)** — `get_previews`
(POST: url batches outgrow query strings), `linkPreviewStore` +
whole-window prefetch (cards render WITH their rows — that, not
placeholders, is what keeps scrolling smooth), generic + Frappe-branded
cards (`LinkPreviewCard.tsx`), YouTube facade title overlay, hover-mode
preference. Still open: the provider filter in Links search, and site
document cards.

- **`get_previews(raw_urls)`** — new read-only batched endpoint. Normalizes
  server-side, looks up stored previews, echoes results keyed by the raw URLs
  requested. Never fetches.
- **`linkPreviewStore`** singleton (raw url → preview, `useSyncExternalStore`),
  following the lazy-data pattern: components register interest via
  `useHasBeenInView`, a short collect-debounce batches one visible screen into
  one call. The realtime event patches the store directly.
- **Generic OG card**: fixed-height Slack-style card (thumbnail cropped, title
  truncated) — deterministic height by design, using stored image dimensions
  for the aspect bucket at first paint.
- **YouTube facade title**: a *reserved* one-line title row on the existing
  click-to-play facade, fed from the store. Reserved from first paint — text
  pops in, height never changes (the provider chain promises deterministic
  heights to the scroll engine).
- **Provider filter in Links search** ✅ (Aug 2026) — built on
  `search_links` (a live DB query over the child table), NOT the sqlite FTS
  as originally sketched: the Links tab never used the FTS, and the child
  rows already carry the provider. The rework also fixed a broken join
  (raw url against the preview doc's hash NAME) and re-based the query on
  `Raven Message Links` with a LEFT join to previews — every link is now
  searchable the moment its message saves, previewed or not. Filter UI:
  `ProviderFilter` (grouped multi-select with brand glyphs) on the links
  tab, URL param `link_provider`, active badge included.
- ~~Hide-preview ✕~~ **DROPPED (Aug 2026)**: v2's per-message hide was
  wrong-shaped — it hid the preview for ALL users when one person clicked ✕.
  v3 replaces it with a **per-user display preference**: previews on hover
  (tooltip) or as a card underneath, the user's choice
  (`Raven User.link_previews`, set in Settings → Appearance). The
  preference governs ONLY the generic metadata card — provider embeds
  (YouTube player, Spotify, meeting cards …) are content and always show.
  On mobile there is no hover: "Preview Card" shows the card, "Link Hover"
  simply means a compact stream — a tap always opens the LINK, never the
  preview (iOS long-press already gives a native peek). The
  `hide_link_preview` endpoint + message field stay only for the v2 bundle
  and die with it.
- **The rickroll rule**: the famous video (`dQw4w9WgXcQ`) never gets a
  preview — not fetched server-side (no preview doc is ever created), not
  embedded client-side. Both sides keep the same `NEVER_PREVIEW_VIDEO_IDS`
  list (raven/links.py, LinkPreview.tsx). A rickroll should stay a surprise.
- **Site document cards** (`Site Document Link` provider): document previews
  are permission-scoped per viewer (`get_preview_data` reads as the session
  user), so they can NEVER enter the shared preview rows or the realtime
  payload — that would leak titles across permission boundaries. Instead: a
  read-only `resolve_document_link(path)` endpoint that reverse-maps the URL
  to (doctype, docname) server-side — desk `/app/<slug>/<name>` via the
  doctype registry, SPA apps (CRM leads, Helpdesk tickets) via a reverse
  sibling of the `raven_document_link_override` hook — then returns
  per-viewer preview data, or nothing if unreadable (card degrades to a
  plain link). No extraction at save: `get_messages` ships no child rows,
  and the stored provider already covers search. Parses paths and reads the
  DB only; never fetches — the SSRF rule holds.

**Done when:** a YouTube link shows its title without playing; an arbitrary
article link shows a card; the Links tab filters by provider; scrolling a
channel full of links causes at most one `get_previews` call per screen.

## Phase 4 — Hardening & lifecycle

*Ship-quality follow-ups.*

- **Image proxy (camo-style)**: preview images currently render from
  third-party hosts, leaking every reader's IP to the link's author (a
  tracking-pixel vector v2 also had — a known, accepted risk until this
  phase). Proxying also buys caching and reliable dimension probing.
- **Stale-refresh policy**: `stale_after` (e.g. 30 days) with lazy refetch on
  access; permanent-failure cache so dead hosts are never hammered.
- **Backfill job** (optional): process links of recent historical messages so
  the Links tab isn't empty on day one.
- **Registered Frappe sites (OAuth) — further out**: users register other
  Frappe sites (support.frappe.io runs Helpdesk, crm.frappe.io runs CRM —
  both frequently shared) and log in to them via OAuth, unlocking dynamic
  document previews of docs living on those sites. When this lands,
  classification for registered hosts comes from that settings-driven list
  (the `frappe_meet_hosted_urls` pattern), NOT hardcoded registry entries —
  org-specific deployments don't belong in code shipped to every install.
  Until then such links classify as `Frappe` via the subdomain rule.

---

## Watch items

- **Matcher-registry drift**: the server classifies (for search), the client
  parses (for embeds). Two lists, one concept. Keep them in one documented
  place — or generate the client registry from shared JSON.
- **Consent walls**: server-side scraping of some hosts returns consent-page
  HTML from some regions. The reserved title row must degrade to empty, never
  to junk.
- **Frontend cache interplay**: when IndexedDB message persistence lands,
  previews stay out of the message cache by design — the store re-validates
  them independently. Don't "optimize" them back into the message payload.
