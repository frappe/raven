export type LinkPreviewStatus = "Pending" | "Fetched" | "Failed" | "Blocked"

/** One stored preview, as get_previews returns it. `url` is the server's
 *  NORMALIZED spelling — the key realtime events arrive under. */
export type LinkPreviewData = {
    url: string
    provider: string
    status: LinkPreviewStatus
    title: string
    description: string
    image: string
    image_width: number
    image_height: number
    site_name: string
    metadata: Record<string, string | number> | null
}

/** null = the server answered and has nothing for this URL. */
export type LinkPreviewEntry = LinkPreviewData | null

/** Minimal client shape — `call` from FrappeContext. POST, not GET: a
 *  window's url batch is too big for a query string. */
export type FrappeCallClient = {
    post: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

type Listener = () => void

/** Collect registrations for this long, then fetch one batch. Long enough
 *  for a whole window's registrations to gather, short enough to feel
 *  instant. */
const FLUSH_DELAY_MS = 80

/** Most urls per call — matches the server's cap. Anything past this would
 *  be silently dropped from the response and wrongly cached as null, so
 *  the rest waits for a follow-up call instead. */
const MAX_BATCH = 50

type PreviewsResponse = { message: Record<string, LinkPreviewData | null> }

/**
 * Link previews for message links, keyed by the RAW url as it appears in
 * the message (the client never normalizes — that lives server-side only).
 *
 * Lazy: a card registers its url when it scrolls into view, a short
 * debounce collects one visible screen, and one get_previews call answers
 * all of them. The `link_previews_updated` realtime event carries whole
 * previews keyed by normalized url; the store keeps a normalized→raw index
 * so those patch straight in without a refetch.
 */
class LinkPreviewStore {
    private entries = new Map<string, LinkPreviewEntry>()
    private listeners = new Map<string, Set<Listener>>()
    /** Raw urls waiting for the next batched call. */
    private pending = new Set<string>()
    /** Raw urls already in a request — re-registering must not double-fetch. */
    private inFlight = new Set<string>()
    /** normalized url → raw urls it serves. Fed by responses, read by realtime patches. */
    private byNormalized = new Map<string, Set<string>>()
    private flushTimer: ReturnType<typeof setTimeout> | null = null
    private client: FrappeCallClient | null = null

    /** Injected once from FrappeContext (and by tests). Kicks a flush in
     *  case registrations arrived before the client existed. */
    setClient(client: FrappeCallClient) {
        this.client = client
        if (this.pending.size > 0) this.scheduleFlush()
    }

    /** Current entry: undefined = never asked, null = server has nothing. */
    get(rawUrl: string): LinkPreviewEntry | undefined {
        return this.entries.get(rawUrl)
    }

    subscribe(rawUrl: string, listener: Listener): () => void {
        let set = this.listeners.get(rawUrl)
        if (!set) {
            set = new Set()
            this.listeners.set(rawUrl, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(rawUrl)
        }
    }

    /** Ask for this url's preview. No-op if already known, queued, or in flight. */
    register(rawUrl: string) {
        if (this.entries.has(rawUrl) || this.pending.has(rawUrl) || this.inFlight.has(rawUrl)) return
        this.pending.add(rawUrl)
        this.scheduleFlush()
    }

    /**
     * Apply previews that arrived WITH a message window — the get_messages
     * side-car (Phase 5 in docs/link-previews-plan.md). Same shape as a
     * get_previews response: raw url → preview, or null for "nothing stored".
     *
     * After seeding, these urls count as known. register() will not fetch
     * them again — that is the point: the window needs no follow-up call,
     * so cards render together with their messages.
     *
     * Seeded previews also feed the normalized index, so realtime patches
     * reach them. A seeded null behaves like a fetched null: when a
     * "previews landed" event arrives, applyRealtime re-asks for it.
     *
     * One rule: a null must never REPLACE data we already have. The store
     * may hold a realtime patch newer than this window's snapshot. Real
     * data always applies.
     */
    seed(entries: Record<string, LinkPreviewData | null>) {
        for (const [rawUrl, preview] of Object.entries(entries)) {
            const existing = this.entries.get(rawUrl)
            if (existing && !preview) continue

            this.pending.delete(rawUrl)
            this.entries.set(rawUrl, preview ?? null)
            if (preview) {
                let raws = this.byNormalized.get(preview.url)
                if (!raws) {
                    raws = new Set()
                    this.byNormalized.set(preview.url, raws)
                }
                raws.add(rawUrl)
            }
            this.notify(rawUrl)
        }
    }

    /**
     * Apply a `link_previews_updated` event. Direct patch for every raw url
     * mapped to the event's normalized urls. Separately, null entries get
     * re-registered: a null often means "the doc didn't exist yet when we
     * asked" (message sent moments ago), and this event is the signal that
     * previews just landed. One batched refetch resolves them.
     */
    applyRealtime(previews: LinkPreviewData[]) {
        for (const preview of previews) {
            const raws = this.byNormalized.get(preview.url)
            if (!raws) continue
            for (const raw of raws) {
                this.entries.set(raw, preview)
                this.notify(raw)
            }
        }

        for (const [raw, entry] of this.entries) {
            if (entry === null) {
                this.entries.delete(raw)
                this.pending.add(raw)
            }
        }
        if (this.pending.size > 0) this.scheduleFlush()
    }

    private scheduleFlush() {
        if (this.flushTimer || !this.client) return
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null
            void this.flush()
        }, FLUSH_DELAY_MS)
    }

    private async flush() {
        if (!this.client || this.pending.size === 0) return
        const batch = [...this.pending].slice(0, MAX_BATCH)
        for (const url of batch) {
            this.pending.delete(url)
            this.inFlight.add(url)
        }

        try {
            // The urls ride in the JSON body — no stringify needed.
            const response = await this.client.post<PreviewsResponse>(
                "raven.api.preview_links.get_previews",
                { urls: batch },
            )
            for (const url of batch) {
                const preview = response.message[url] ?? null
                this.entries.set(url, preview)
                if (preview) {
                    let raws = this.byNormalized.get(preview.url)
                    if (!raws) {
                        raws = new Set()
                        this.byNormalized.set(preview.url, raws)
                    }
                    raws.add(url)
                }
                this.notify(url)
            }
        } catch {
            // Nothing was stored, so a later register retries the batch.
        } finally {
            for (const url of batch) this.inFlight.delete(url)
            // Anything past the batch cap is still pending — fetch it next.
            if (this.pending.size > 0) this.scheduleFlush()
        }
    }

    private notify(rawUrl: string) {
        this.listeners.get(rawUrl)?.forEach((listener) => listener())
    }

    /** Test-only: wipe everything between cases. */
    reset() {
        if (this.flushTimer) clearTimeout(this.flushTimer)
        this.flushTimer = null
        this.entries.clear()
        this.listeners.clear()
        this.pending.clear()
        this.inFlight.clear()
        this.byNormalized.clear()
        this.client = null
    }
}

export const linkPreviewStore = new LinkPreviewStore()
