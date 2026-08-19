import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { markUnreadSeeded } from "@hooks/useClearReadNotifications"

type UnreadThreadRow = { name: string; unread_count: number }

/** Number of threads with unread messages — for the sidebar badge. */
export const useUnreadThreadsCount = (): number => {
    return useSyncExternalStore(
        useCallback((onChange) => unreadThreadsStore.subscribe(onChange), []),
        () => unreadThreadsStore.getCount(),
    )
}

/**
 * Seeds + reconciles the unread-threads set from the server's authoritative list. Mounted
 * once at the app shell. The participant-scoped realtime event keeps the set live between
 * fetches; this self-heals any drift on mount, focus, and reconnect (e.g. events missed
 * while disconnected). No workspace filter → counts unread threads across all workspaces.
 */
// Module-level on purpose: it only touches module singletons, so there's no
// reason for it to live (and churn identity) inside the render cycle — and the
// effect below can list it-free deps honestly.
const applyUnreadThreads = (message: UnreadThreadRow[] | undefined) => {
    if (!message) return
    unreadThreadsStore.reconcile(message.map((row) => row.name))
    // The store now holds the server's full truth — stale tray notifications
    // (for threads read on other devices) can be swept safely.
    markUnreadSeeded("threads")
}

export const useUnreadThreadsSync = () => {
    const { data } = useFrappeGetCall<{ message: UnreadThreadRow[] }>(
        "raven.api.threads.get_unread_threads",
        undefined,
        "unread_threads",
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            // Reconcile on every FETCH, not just on data change: SWR deep-compares
            // responses and keeps the same `data` reference when the payload matches
            // the previous fetch — but the STORE drifts from that payload via
            // realtime adds in between, so a refetch returning the same list as
            // last time must still overwrite the store (same bug as the
            // notifications badge — see useUnreadNotificationsSync).
            onSuccess: (fetched) => applyUnreadThreads(fetched?.message),
        },
    )

    // Still needed for cache-served data (a remount inside the deduping window
    // gets `data` without a request, so onSuccess doesn't fire).
    useEffect(() => applyUnreadThreads(data?.message), [data])
}
