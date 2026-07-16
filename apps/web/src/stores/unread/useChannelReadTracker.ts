import { useCallback, useContext, useEffect, useRef } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { useDebounceCallback } from "usehooks-ts"
import type { Message } from "@raven/types/common/Message"
import { channelUnreadStore } from "./store"
import { sendOrQueueVisit } from "./visitOutbox"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { markNotificationsReadOnView } from "@stores/notifications/unreadStore"

/** How long after the last in-view message before we flush the watermark to the server. */
const FLUSH_DELAY = 1500

/**
 * Tracks how far the user has read in a channel and flushes that watermark to
 * the server (last_visit), which is what defines unread counts.
 *
 * The watermark is the creation timestamp of the newest message that has scrolled
 * into view — forward-only, so scrolling UP never marks newer messages read. It's
 * flushed debounced as the user reads, and force-flushed on the moments a trailing
 * debounce would be lost (channel switch / unmount, tab hide).
 *
 * While the user is caught up to the live edge and looking, the channel is
 * registered as the active-read channel so realtime increments skip it, and its
 * badge is held at zero locally.
 *
 * Returns `onMessageInView` to feed from the stream's intersection observers.
 */
export const useChannelReadTracker = (
    channelID: string,
    { isAtBottom, hasNewerMessages }: { isAtBottom: boolean; hasNewerMessages: boolean },
) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    /** Newest message creation seen this session (forward-only). */
    const watermarkRef = useRef<string | null>(null)
    /** Last watermark handed to sendOrQueueVisit — avoids re-sending an unchanged value.
     *  Safe to advance eagerly: a failed post is queued durably (visit outbox), so
     *  delivery is guaranteed either way. */
    const sentRef = useRef<string | null>(null)
    /** Live-edge state read at flush time (caught up = reached the bottom). */
    const caughtUpRef = useRef(false)

    // These refs hold PER-CHANNEL state, but the hook instance survives channel
    // switches (ChatStream isn't remounted per channel) — without a reset, the
    // previous channel's newer watermark blocks every onMessageInView advance in
    // the next channel, the local badge is zeroed with a foreign timestamp, and
    // track_visit never fires — so the unread count comes back on refresh.
    // Deliberately an EFFECT, not a render-time reset: the previous channel's
    // pending debounce is force-flushed in an effect CLEANUP below, and that
    // flush reads watermarkRef — cleanups run before effects, so the old channel
    // still sees its own watermark; then this wipes the slate for the new one.
    useEffect(() => {
        watermarkRef.current = null
        sentRef.current = null
        caughtUpRef.current = false
    }, [channelID])

    const flush = useCallback(() => {
        const watermark = watermarkRef.current
        if (!watermark) return
        // First flush this mount: adopt the server's last_visit (delivered on channel load)
        // as the baseline. Opening a channel you're already caught up on then posts nothing,
        // since its newest message is at/below that watermark. Pristine — never advanced by
        // local reads, unlike the unread store's lastSeen.
        if (sentRef.current === null) sentRef.current = channelUnreadStore.getServerWatermark(channelID)
        // Fixed-width backend datetimes: lexicographic order == chronological order.
        if (sentRef.current && watermark <= sentRef.current) return
        sentRef.current = watermark
        // Optimistic local read — the badge clears instantly; the post and the
        // focus reconcile both reconverge if anything drifts.
        channelUnreadStore.markRead(channelID, watermark, caughtUpRef.current)
        // If this is a thread, clear it from the unread-threads badge (no-op for channels).
        unreadThreadsStore.remove(channelID)
        // Delivered now, or queued durably and replayed on reconnect (visit outbox) —
        // a failed post can no longer strand the server's last_visit in the past.
        sendOrQueueVisit(call, channelID, watermark)
    }, [channelID, call])

    const debouncedFlush = useDebounceCallback(flush, FLUSH_DELAY)

    const onMessageInView = useCallback(
        (message: Message) => {
            // Viewing a message with an unread notification (a mention of you / a reaction on
            // your message) marks it read — O(1) no-op for everything else. Deliberately NOT
            // forward-only like the watermark: scrolling UP to an older mention clears it too.
            markNotificationsReadOnView(call, message.name)
            if (!watermarkRef.current || message.creation > watermarkRef.current) {
                watermarkRef.current = message.creation
                debouncedFlush()
            }
        },
        [call, debouncedFlush],
    )

    // Register the active-read channel and hold its badge at zero while the user
    // is caught up AND looking. Re-evaluated on scroll-edge changes and tab focus.
    useEffect(() => {
        const apply = () => {
            const caughtUp = isAtBottom && !hasNewerMessages && document.visibilityState === "visible"
            caughtUpRef.current = isAtBottom && !hasNewerMessages
            channelUnreadStore.setActiveReadChannel(caughtUp ? channelID : null)
            // Mirror for the unread-threads badge (a thread is a channel here; no-op otherwise).
            unreadThreadsStore.setActiveThread(caughtUp ? channelID : null)
            if (caughtUp && watermarkRef.current) channelUnreadStore.markRead(channelID, watermarkRef.current, true)
        }
        apply()
        document.addEventListener("visibilitychange", apply)
        return () => {
            document.removeEventListener("visibilitychange", apply)
            channelUnreadStore.setActiveReadChannel(null)
            unreadThreadsStore.setActiveThread(null)
        }
    }, [channelID, isAtBottom, hasNewerMessages])

    // Force-flush the pending watermark when a trailing debounce would be lost:
    // tab hidden (covers tab close / navigation away) and channel switch / unmount.
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "hidden") debouncedFlush.flush()
        }
        document.addEventListener("visibilitychange", onVisibility)
        return () => {
            document.removeEventListener("visibilitychange", onVisibility)
            // Call flush DIRECTLY, not debouncedFlush.flush(): on unmount,
            // useDebounceCallback's own cleanup runs first (declared earlier) and
            // cancels the pending invocation, so .flush() would find nothing and
            // silently drop the last ~1.5s of reading (mobile back-swipe, opening
            // the Threads/Notifications page). The raw call doesn't care about the
            // timer, and re-posting is impossible — an unchanged watermark is a
            // no-op via sentRef. The cancel just clears any still-armed timer on a
            // channel switch (its late fire would also have been a no-op).
            flush()
            debouncedFlush.cancel()
        }
    }, [channelID, debouncedFlush, flush])

    return { onMessageInView }
}
