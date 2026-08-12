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
    /** Newest message that RENDERED while the tab was hidden — not read yet.
     *  Adopted into the watermark when the tab becomes visible again (the
     *  messages are on screen then, and the in-view observers won't refire for
     *  rows that entered the viewport while hidden). */
    const hiddenSeenRef = useRef<string | null>(null)
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
        hiddenSeenRef.current = null
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
            // A HIDDEN tab is not being read. Messages can render (and fire the
            // in-view observers) while the user is on another tab — advancing the
            // watermark then posted track_visit and cleared counts for messages
            // nobody saw. Record how far the stream rendered so the visibility
            // handler below adopts it on return; nothing else runs.
            if (document.visibilityState !== "visible") {
                if (!hiddenSeenRef.current || message.creation > hiddenSeenRef.current) {
                    hiddenSeenRef.current = message.creation
                }
                return
            }
            // Viewing a message with an unread notification (a mention of you / a reaction on
            // your message) marks it read — O(1) no-op for everything else. Deliberately NOT
            // forward-only like the watermark: scrolling UP to an older mention clears it too.
            markNotificationsReadOnView(call, message.name)
            if (!watermarkRef.current || message.creation > watermarkRef.current) {
                watermarkRef.current = message.creation
                // Instant LOCAL badge clear for the one unambiguous case: the user is
                // at the live edge, tab visible, and the channel's newest message just
                // hit their screen — that channel is read, now, not 1.5s from now
                // (users read the debounce hold as lag). Local only: the server post
                // and its sentRef bookkeeping stay behind the flush debounce below.
                // Partial reads (not caught up) keep hold-then-reconcile semantics.
                // Drift-safe: markRead is forward-only and a lost post is replayed
                // by the visit outbox.
                if (caughtUpRef.current && document.visibilityState === "visible") {
                    channelUnreadStore.markRead(channelID, message.creation, true)
                    // Mirror for the unread-threads badge (no-op for channels).
                    unreadThreadsStore.remove(channelID)
                }
                debouncedFlush()
            }
        },
        [call, channelID, debouncedFlush],
    )

    // Register the active-read channel and hold its badge at zero while the user
    // is caught up AND looking. Re-evaluated on scroll-edge changes and tab focus.
    useEffect(() => {
        const apply = () => {
            const visible = document.visibilityState === "visible"
            // Back on the tab: adopt what rendered while hidden — those messages
            // are on screen NOW, being looked at, and their observers won't
            // refire. The markRead below (when caught up) clears the badge, and
            // the debounced flush posts the visit.
            if (visible && hiddenSeenRef.current) {
                const seen = hiddenSeenRef.current
                hiddenSeenRef.current = null
                if (!watermarkRef.current || seen > watermarkRef.current) {
                    watermarkRef.current = seen
                    debouncedFlush()
                }
            }
            const caughtUp = isAtBottom && !hasNewerMessages && visible
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
    }, [channelID, isAtBottom, hasNewerMessages, debouncedFlush])

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
