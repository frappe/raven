import { useEffect } from "react"
import { channelUnreadStore } from "@stores/unread/store"
import { channelStore } from "@stores/channels/store"
import { unreadThreadsStore } from "@stores/threads/unreadStore"

/**
 * Mirrors the unread total onto the app icon via the Badging API — iOS 16.4+
 * installed PWAs, Android and desktop Chromium; a silent no-op everywhere else.
 *
 * This covers the APP-RUNNING case only (the stores are live and reconcile reads
 * made on other devices). While the app is closed, sw.js sets the badge: it
 * supports an authoritative `unread_count` from the push payload, but the server
 * doesn't send one yet (TODO, server-side), so in practice the SW uses its
 * fallback — the count of displayed notifications. The two definitions differ,
 * which is fine while asleep; on every return to the app the resume re-sync
 * below re-imposes this hook's definition. Remaining gap: reading on desktop
 * with NO subsequent push leaves the badge stale until the next open — the same
 * trade WhatsApp ships; closing it needs badge-only pushes on read events
 * (Declarative Web Push, iOS 18.4+), which is server-side work.
 */
export const useAppBadge = () => {
    useEffect(() => {
        if (typeof navigator.setAppBadge !== "function") return
        // Unread conversations (channels + DMs, MUTED excluded — muted means "don't
        // interrupt me", and the icon badge is an interruption, same rule as every
        // in-app aggregate) + unread THREADS (pushes fire for thread replies too, so
        // a definition without them would clear the icon while a notified-about
        // thread is still unread).
        // Skip redundant Badging API calls: sync runs on EVERY store notification
        // (each incoming message anywhere), and setAppBadge is a browser/OS call —
        // only issue it when the value actually changed. `force` bypasses the skip.
        let lastApplied: number | null = null
        const sync = (force = false) => {
            const conversations = [...channelStore.getChannels(), ...channelStore.getDMChannels()]
                .filter((channel) => !channel.muted)
                .reduce((total, channel) => total + (channelUnreadStore.getState(channel.name).count > 0 ? 1 : 0), 0)
            const total = conversations + unreadThreadsStore.getCount()
            if (!force && total === lastApplied) return
            lastApplied = total
            if (total > 0) navigator.setAppBadge(total).catch(() => { })
            else navigator.clearAppBadge?.().catch(() => { })
        }
        sync(true)

        // Re-assert on RESUME, not just on store changes — and FORCED, past the
        // skip-if-unchanged guard. While the page is frozen (backgrounded PWA) the
        // SW also writes the badge from pushes; if everything gets read elsewhere
        // before the user returns, the resume reconcile finds the store already at
        // 0 → no change anywhere → only an unconditional write can evict the SW's
        // stale badge. No race with the focus reconcile that fires at the same
        // moment: both writers funnel through this same sync() and the reconcile
        // lands last (it's a network round trip) — if it changes the stores, the
        // subscriptions below re-sync with server truth; if it doesn't, the value
        // written here already WAS server truth.
        const onVisible = () => {
            if (document.visibilityState === "visible") sync(true)
        }
        document.addEventListener("visibilitychange", onVisible)
        // Wrapped so a listener argument can never be misread as `force`.
        const onStoreChange = () => sync()
        const unsubscribeUnread = channelUnreadStore.subscribeGlobal(onStoreChange)
        const unsubscribeThreads = unreadThreadsStore.subscribe(onStoreChange)
        // Channel LIST changes matter too: muting/unmuting flips a channel in and
        // out of the aggregate without its unread count changing.
        const unsubscribeChannels = channelStore.subscribe(onStoreChange)
        return () => {
            document.removeEventListener("visibilitychange", onVisible)
            unsubscribeUnread()
            unsubscribeThreads()
            unsubscribeChannels()
        }
    }, [])
}
