import { channelMessagesStore } from "./store"
import { channelUnreadStore } from "@stores/unread/store"
import { linkPreviewStore } from "@stores/linkPreviews/store"
import { channelStore } from "@stores/channels/store"
import { getConnectionEpoch, isWindowStale, markWindowFresh } from "@stores/connectionFreshness"
import { MessagesPage } from "./types"

const PAGE_SIZE = 30

/** Minimal client shape — `call` from FrappeContext. */
export type FrappeCallClient = {
    get: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

type PageResponse = { message: MessagesPage }

/**
 * Feed a page's side-car previews into the preview store — BEFORE the page
 * goes into the messages store. The rows then find their previews on their
 * very first render, so cards paint together with the messages instead of
 * popping in later and jumping the scroll. The side-car lives on the
 * response only; nothing persists it.
 */
const seedPreviews = (page: MessagesPage) => {
    if (page.previews) linkPreviewStore.seed(page.previews)
}

const inFlight = new Set<string>()

/**
 * IO layer: fetches pages and feeds them to the store.
 * Responses always apply to the channel they were requested for,
 * so a channel switch mid-flight cannot corrupt another channel's state.
 */

/** In-flight initial loads, keyed by channel + anchor message. If the same load is
 *  requested twice, the second caller gets the first call's promise — so awaiting it
 *  always means "that fetch has finished", never "someone else is fetching". */
const inFlightInitial = new Map<string, Promise<void>>()

/**
 * Several things can request a channel's first page at almost the same time (a sidebar
 * hover prefetch, the stream mounting, a jump to a specific message). Their responses
 * come back in any order, and simply applying whichever lands last let a stale response
 * overwrite the page the user actually asked for. So: each request takes a number, and
 * a response is only applied if its number is still the channel's newest. Older
 * responses are thrown away.
 */
const windowIntent = new Map<string, number>()

/**
 * Channels where the user is currently being navigated to a specific message (deep
 * link / notification / reply click). While a channel is in this map, "plain" first-page
 * loads (ones not centered on a message) are refused entirely — they would replace the
 * page containing the target with the latest page and break the navigation. Set by
 * ChatStream; removed when the user leaves the channel or clicks "jump to present".
 */
const targetClaims = new Map<string, string>()

export const claimWindowForTarget = (channelID: string, messageID: string) => {
    targetClaims.set(channelID, messageID)
}

export const releaseWindowClaim = (channelID: string) => {
    targetClaims.delete(channelID)
}

/** Loads the window — latest messages, or around `baseMessage` when jumping to one.
 *  Resolves when the fetch has settled (page applied, discarded as stale, or failed). */
export const loadInitialMessages = (
    client: FrappeCallClient,
    channelID: string,
    baseMessage?: string,
): Promise<void> => {
    // The user is being navigated to a specific message in this channel — a plain
    // (uncentered) load would replace that page, so refuse it (see targetClaims).
    if (!baseMessage && targetClaims.has(channelID)) {
        return Promise.resolve()
    }

    // Keyed per anchor message, so a jump-to-message isn't mistaken for a duplicate of a
    // plain load that's already in flight (and vice versa).
    const key = `${channelID}:initial:${baseMessage ?? ""}`
    const existing = inFlightInitial.get(key)
    if (existing) return existing

    // Take the channel's next request number. If another initial load starts after this
    // one, ours becomes stale and its response will be thrown away (see windowIntent).
    const token = (windowIntent.get(channelID) ?? 0) + 1
    windowIntent.set(channelID, token)

    // Read the connection-break counter BEFORE fetching — see markWindowFresh.
    const epochAtStart = getConnectionEpoch()

    channelMessagesStore.startLoading(channelID)
    const run = (async () => {
        try {
            const response = await client.get<PageResponse>("raven.api.chat_stream.get_messages", {
                channel_id: channelID,
                limit: PAGE_SIZE,
                base_message: baseMessage,
                // We track last_visit ourselves (useChannelReadTracker), so the fetch must
                // not also write it — that GET-time write can deadlock with a concurrent send.
                update_last_visit: false,
                // Center the window on the first unread message (for the "New messages" divider)
                // unless we're jumping to a specific message — an explicit jump wins.
                anchor_to_unread: !baseMessage,
            })
            // A newer initial load started while we were fetching — discard this response.
            if (windowIntent.get(channelID) !== token) return
            seedPreviews(response.message)
            channelMessagesStore.setInitialPage(channelID, response.message)
            // Baseline the read tracker with the server's last_visit so it won't re-post a
            // watermark already recorded (opening a caught-up channel writes nothing).
            channelUnreadStore.setServerWatermark(channelID, response.message.last_visit)
            markWindowFresh(channelID, epochAtStart)
        } catch (error) {
            // Same staleness rule for failures — don't show an error for a superseded fetch.
            if (windowIntent.get(channelID) !== token) return
            channelMessagesStore.failLoading(channelID, errorMessage(error))
        } finally {
            inFlightInitial.delete(key)
        }
    })()
    inFlightInitial.set(key, run)
    return run
}

/**
 * Hover/highlight prefetch: warms a COLD channel's first page into the same store ChatStream
 * reads, so opening it skips the loading skeleton. No-op unless the id is a real channel/DM
 * (so a Command-menu user/settings value is ignored) and its window is still idle — a warm or
 * loading channel must not be reset. Idempotent via loadInitialMessages' inFlight guard.
 */
export const prefetchChannel = (client: FrappeCallClient, channelID: string) => {
    if (!channelID) return
    if (!channelStore.getChannel(channelID)) return
    if (channelMessagesStore.getState(channelID).status !== "idle") return
    loadInitialMessages(client, channelID)
}

export const loadOlderMessages = async (client: FrappeCallClient, channelID: string) => {
    if (!channelMessagesStore.beginPagination(channelID, "older")) return
    const oldestID = channelMessagesStore.getState(channelID).order[0]
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_older_messages", {
            channel_id: channelID,
            from_message: oldestID,
            limit: PAGE_SIZE,
        })
        seedPreviews(response.message)
        channelMessagesStore.setOlderPage(channelID, response.message)
    } catch {
        channelMessagesStore.endPagination(channelID, "older")
    }
}

export const loadNewerMessages = async (client: FrappeCallClient, channelID: string) => {
    if (!channelMessagesStore.beginPagination(channelID, "newer")) return
    const state = channelMessagesStore.getState(channelID)
    const newestID = state.order[state.order.length - 1]
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_newer_messages", {
            channel_id: channelID,
            from_message: newestID,
            limit: PAGE_SIZE,
            // last_visit is tracked client-side; don't let the fetch write it (deadlock risk).
            update_last_visit: false,
        })
        seedPreviews(response.message)
        channelMessagesStore.setNewerPage(channelID, response.message)
    } catch {
        channelMessagesStore.endPagination(channelID, "newer")
    }
}

/**
 * Recompute the "New messages" divider from the user's latest read position —
 * server last_visit at load, or how far they've read since (lastSeen), whichever
 * is later. Clears the divider when everything is read; otherwise moves it to the
 * first message past that position. Used wherever returning to an already-rendered
 * channel should behave like a fresh entry (warm re-entry, quiet reconcile, and
 * coming back from a mobile thread layer).
 */
export const recomputeUnreadAnchor = (channelID: string) => {
    const watermark = [channelUnreadStore.getServerWatermark(channelID), channelUnreadStore.getState(channelID).lastSeen]
        .filter((t): t is string => Boolean(t))
        .sort()
        .pop() ?? null
    channelMessagesStore.refreshUnreadAnchor(channelID, watermark)
}

/** The deepest window a quiet reconcile will replace. Replacing a deeper one with a
 *  smaller refetch would delete the older messages the user scrolled back to and yank
 *  their scroll — so deeper stale windows are left alone here, and useChannelMessages
 *  reloads them fresh on the next open instead. (70 + one page of headroom = 100.) */
export const MAX_QUIET_RECONCILE_WINDOW = 70

/**
 * Quietly refetches a channel whose messages might be out of date because the
 * realtime connection broke after they were loaded (see stores/connectionFreshness).
 * Refetching the whole window catches everything a gap can lose: new messages, but
 * also reactions, edits, deletes and pins on messages we already have — changes
 * that "fetch anything newer than X" can never see.
 *
 * "Quietly" = no loading spinner: the messages already on screen stay put, and
 * after the refetch only the ones that actually changed re-render.
 *
 * Does nothing when the channel is provably up to date — which is why calling it
 * on every open costs nothing as long as the connection never broke.
 */
export const reconcileStaleWindow = async (client: FrappeCallClient, channelID: string) => {
    const state = channelMessagesStore.getState(channelID)
    // Reconnect self-heal for a FAILED window: while the stream sits mounted on
    // the error card, nothing else retries — this runs on every connection
    // epoch bump (online, socket reconnect, unfreeze), so do a fresh full load.
    // loadInitialMessages carries its own guards (navigation claim, in-flight
    // dedupe), so a plain call here is safe.
    if (state.status === "error") {
        loadInitialMessages(client, channelID)
        return
    }
    // Only a loaded, at-the-bottom window can be quietly out of date:
    //  - a channel not loaded yet gets a full (stamping) fetch anyway
    //  - a window scrolled back into history is thrown away and refetched on
    //    re-entry (useChannelMessages), so it heals itself
    if (state.status !== "ready" || state.hasNewerMessages) return
    // Scrolled back too far to replace safely — leave it stale, reload on next open.
    if (state.order.length > MAX_QUIET_RECONCILE_WINDOW) return
    // The user is being navigated to a specific message right now — don't replace
    // the window under them. The channel stays marked stale, so the next open (or
    // the next break) tries again.
    if (targetClaims.has(channelID)) return
    if (!isWindowStale(channelID)) return

    const key = `${channelID}:reconcile`
    if (inFlight.has(key)) return
    inFlight.add(key)

    const epochAtStart = getConnectionEpoch()
    const token = (windowIntent.get(channelID) ?? 0) + 1
    windowIntent.set(channelID, token)
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_messages", {
            channel_id: channelID,
            // Window size + one page of headroom: without it, messages that arrived
            // during the gap would push the same number of older (possibly being-read)
            // messages out of the refetched span. ≤ 100 thanks to the depth guard.
            limit: state.order.length + PAGE_SIZE,
            update_last_visit: false,
            // Always fetch the bottom of the chat — never re-anchor an already-open
            // window to the unread position.
            anchor_to_unread: false,
        })
        // The user started their own fetch while ours was running — theirs wins.
        if (windowIntent.get(channelID) !== token) return
        seedPreviews(response.message)
        channelMessagesStore.setInitialPage(channelID, response.message)
        channelUnreadStore.setServerWatermark(channelID, response.message.last_visit)
        // Replacing the window cleared the "New messages" divider — put it back the
        // same way a warm re-entry does: on the first message past the last read one.
        recomputeUnreadAnchor(channelID)
        markWindowFresh(channelID, epochAtStart)
    } catch {
        // Best effort: the channel just stays marked stale; the next open (or the
        // next break) retries.
    } finally {
        inFlight.delete(key)
    }
}

/** Discards the detached window and refetches the live edge. */
export const jumpToLatestMessages = async (client: FrappeCallClient, channelID: string) => {
    // The user explicitly asked for the latest messages — lift the "navigating to a
    // message" claim first, or the plain load below would be refused.
    releaseWindowClaim(channelID)
    channelMessagesStore.reset(channelID)
    await loadInitialMessages(client, channelID)
}

const errorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    return "Failed to load messages"
}
