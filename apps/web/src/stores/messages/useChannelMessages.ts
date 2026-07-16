import { useCallback, useContext, useEffect, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import {
    FrappeCallClient,
    jumpToLatestMessages,
    loadInitialMessages,
    loadNewerMessages,
    loadOlderMessages,
    reconcileStaleWindow,
    recomputeUnreadAnchor,
    MAX_QUIET_RECONCILE_WINDOW,
} from "./loaders"
import { selectStreamBlocks } from "./selectors"
import { channelMessagesStore } from "./store"
import { isWindowStale, subscribeConnectionEpoch } from "@stores/connectionFreshness"

/**
 * Subscribes a component to a channel's message window and triggers the
 * initial fetch. Components only ever read through this hook; all writes
 * go through the store's action methods.
 *
 * `initialBaseMessage` centers the FIRST fetch on a message (deep links) —
 * without it, a plain latest-page load would race the deep link's around-fetch
 * and whichever landed last would win the window.
 */
export const useChannelMessages = (
    channelID: string,
    pinnedMessagesString?: string,
    initialBaseMessage?: string | null,
) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as FrappeCallClient

    const state = useSyncExternalStore(
        useCallback((onChange) => channelMessagesStore.subscribe(channelID, onChange), [channelID]),
        () => channelMessagesStore.getState(channelID),
    )

    useEffect(() => {
        const current = channelMessagesStore.getState(channelID)
        if (current.status === "idle") {
            loadInitialMessages(client, channelID, initialBaseMessage ?? undefined)
        } else if (current.hasNewerMessages) {
            // A hydrated live-edge window renders instantly from memory, but a
            // DETACHED window (user left while reading history) is stale by
            // definition — discard it and come back to the present (or to the
            // deep-link target, if this visit has one).
            channelMessagesStore.reset(channelID)
            loadInitialMessages(client, channelID, initialBaseMessage ?? undefined)
        } else if (isWindowStale(channelID) && current.order.length > MAX_QUIET_RECONCILE_WINDOW) {
            // Stale AND too deep for the quiet reconcile to replace safely — treat it
            // like a detached window: discard and load fresh. (Re-entry lands at the
            // bottom anyway, so the scrolled-back depth serves nobody. Without this,
            // a deep stale window would stay stale forever.)
            channelMessagesStore.reset(channelID)
            loadInitialMessages(client, channelID, initialBaseMessage ?? undefined)
        } else {
            // Warm live-edge re-entry: NOT refetched, so the unread divider would stay frozen
            // at the first load and linger after you'd read everything. Recompute it against
            // the furthest-read position — cleared if caught up; a fresh line appears before
            // messages that arrived while away.
            recomputeUnreadAnchor(channelID)
            // The in-memory window is only guaranteed correct if the socket stayed
            // connected the whole time since it was fetched. If it didn't (phone
            // locked, app backgrounded), quietly refetch behind the instant render —
            // this is what brings back reactions/edits/deletes missed while
            // suspended. If the connection never broke, this does nothing.
            reconcileStaleWindow(client, channelID)
        }
    }, [channelID])

    // The check above runs when a channel is OPENED — but the connection can also
    // break while the user is already looking at one (lock the phone on it, come
    // back). So while this stream is mounted, refetch as soon as a break is
    // recorded. Does nothing when the window is already up to date.
    useEffect(
        () => subscribeConnectionEpoch(() => reconcileStaleWindow(client, channelID)),
        [channelID],
    )

    const loadOlder = useCallback(() => loadOlderMessages(client, channelID), [channelID])
    const loadNewer = useCallback(() => loadNewerMessages(client, channelID), [channelID])
    const jumpToLatest = useCallback(() => jumpToLatestMessages(client, channelID), [channelID])
    /** Replaces the window with the page around the given message. Resolves true if the
     *  message is in the window once the fetch finishes; false means it isn't there
     *  (deleted, or the id doesn't belong to this channel) — the caller can stop trying. */
    const jumpToMessage = useCallback(
        async (messageID: string) => {
            await loadInitialMessages(client, channelID, messageID)
            return channelMessagesStore.getState(channelID).byId.has(messageID)
        },
        [channelID],
    )

    return {
        /** Render-ready blocks: messages with continuation/pinned flags + date/unread dividers.
         * The unread divider is anchored to `state.firstUnreadMessage` (frozen at entry). */
        blocks: selectStreamBlocks(state, pinnedMessagesString),
        /** First unread message id at entry, or null — the scroll engine lands on its divider. */
        firstUnreadMessage: state.firstUnreadMessage,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasOlderMessages: state.hasOlderMessages,
        /** True when the window is detached from the live edge (show "jump to present"). */
        hasNewerMessages: state.hasNewerMessages,
        loadingOlder: state.loadingOlder,
        loadingNewer: state.loadingNewer,
        loadOlder,
        loadNewer,
        jumpToLatest,
        jumpToMessage,
    }
}
