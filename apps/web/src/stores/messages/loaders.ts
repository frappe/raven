import { channelMessagesStore } from "./store"
import { channelUnreadStore } from "@stores/unread/store"
import { linkPreviewStore } from "@stores/linkPreviews/store"
import { channelStore } from "@stores/channels/store"
import { getConnectionEpoch, isWindowStale, markWindowFresh } from "@stores/connectionFreshness"
import { isOptimistic, MAX_WINDOW_SIZE, MessagesPage } from "./types"

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

/** A stale window deeper than this is reloaded fresh on the next OPEN instead of
 *  refreshed in place (useChannelMessages): re-entry lands at the bottom anyway, so
 *  the scrolled-back depth serves nobody. The on-screen refresh below has no depth
 *  limit, because it refreshes the window's own span and nothing on screen moves. */
export const MAX_QUIET_RECONCILE_WINDOW = 70

const initialLoadInFlight = (channelID: string) =>
    [...inFlightInitial.keys()].some((key) => key.startsWith(`${channelID}:initial:`))

/**
 * Quietly refreshes a channel whose messages might be out of date because the
 * realtime connection broke after they were loaded (see stores/connectionFreshness).
 *
 * The window's own span is fetched again, from its oldest message up, capped at the
 * window limit (300). That catches everything a gap can lose: new messages, but also
 * reactions, edits, deletes, pins and thread flags on messages already loaded, which
 * "fetch anything newer than X" can never see. Starting from the OLDEST message
 * rather than the live edge is what makes this safe at any depth: the messages being
 * read are always in the response, so none are dropped and the scroll never moves.
 * If more messages arrived than fit, the window is marked as behind the live edge
 * and the "jump to present" button takes over.
 *
 * "Quietly" = no loading spinner: the messages already on screen stay put, and
 * after the refresh only the ones that actually changed re-render.
 *
 * Does nothing when the channel is provably up to date, which is why calling it
 * on every open costs nothing as long as the connection never broke.
 */
export const reconcileStaleWindow = async (client: FrappeCallClient, channelID: string): Promise<void> => {
    const state = channelMessagesStore.getState(channelID)
    // Reconnect self-heal for a FAILED window: while the stream sits mounted on
    // the error card, nothing else retries. This runs on every connection
    // epoch bump (online, socket reconnect, unfreeze), so do a fresh full load.
    // loadInitialMessages carries its own guards (navigation claim, in-flight
    // dedupe), so a plain call here is safe.
    if (state.status === "error") {
        loadInitialMessages(client, channelID)
        return
    }
    // Only a loaded window still joined to the live edge can be quietly out of date:
    //  - a channel not loaded yet gets a full (stamping) fetch anyway
    //  - a window detached from the live edge (the user paged into history past
    //    the cap, or jumped there) is thrown away and refetched on re-entry
    //    (useChannelMessages), so it heals itself
    if (state.status !== "ready" || state.hasNewerMessages) return
    if (!isWindowStale(channelID)) return
    // A load in flight (a jump to a message, or the first page) stamps the window
    // itself, and refreshing under it would mix two windows.
    if (initialLoadInFlight(channelID)) return

    const key = `${channelID}:reconcile`
    if (inFlight.has(key)) return
    // The span starts at the oldest message the server knows about. A message that
    // is still being sent has no server row yet.
    const oldest = state.order
        .map((id) => state.byId.get(id))
        .find((message) => message && !isOptimistic(message))
    if (!oldest) return
    // Sends still in flight are kept on top of what the server returns, so they
    // count against the room the window has.
    const inFlightSends = state.order.filter((id) => {
        const message = state.byId.get(id)
        return message && isOptimistic(message)
    }).length
    inFlight.add(key)

    // Read the connection-break counter BEFORE fetching. See markWindowFresh.
    const epochAtStart = getConnectionEpoch()
    const token = (windowIntent.get(channelID) ?? 0) + 1
    windowIntent.set(channelID, token)
    let oldestWasDeleted = false
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_newer_messages", {
            channel_id: channelID,
            from_message: oldest.name,
            include_from_message: true,
            // As much as the window can hold, not "the window plus a page": a reader
            // at the live edge should get everything that arrived, and a page of room
            // would detach them after 30 messages. The server returns only what
            // exists, so a quiet night costs the window's size, not the limit.
            limit: Math.max(1, MAX_WINDOW_SIZE - inFlightSends),
            update_last_visit: false,
        })
        // The user started their own fetch while ours was running. Theirs wins.
        if (windowIntent.get(channelID) !== token) return
        // Older history loaded while the request ran (or the window came off the live
        // edge): the window no longer has the shape this response answers for, and
        // merging the two could drop the rows just scrolled to. Discard the response;
        // the window stays stale and the next check retries.
        const current = channelMessagesStore.getState(channelID)
        if (current.order[0] !== state.order[0] || current.hasNewerMessages) return
        // The span always includes its first message, so an empty response means
        // the server no longer has it: it was deleted during the gap. Drop it and
        // try again from the next one, leaving the window stale until that lands.
        if (response.message.messages.length === 0) {
            channelMessagesStore.messageDeleted(channelID, oldest.name)
            oldestWasDeleted = true
        } else {
            seedPreviews(response.message)
            // `state` is from before the request: its rows are the ones the response
            // answers for. Anything added since came over the socket and is kept.
            channelMessagesStore.refreshWindow(channelID, response.message, state.order)
            // Another device may have read the channel during the gap: take the
            // server's read watermark before placing the "New messages" divider on
            // the first message past the last read one, as a warm re-entry does.
            channelUnreadStore.setServerWatermark(channelID, response.message.last_visit)
            recomputeUnreadAnchor(channelID)
            markWindowFresh(channelID, epochAtStart)
        }
    } catch {
        // Best effort: the window stays marked stale, so the next connection break
        // or the next open retries.
    } finally {
        inFlight.delete(key)
    }
    if (oldestWasDeleted) return reconcileStaleWindow(client, channelID)
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
