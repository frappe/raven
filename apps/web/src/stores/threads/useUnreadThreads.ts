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
export const useUnreadThreadsSync = () => {
    const { data } = useFrappeGetCall<{ message: UnreadThreadRow[] }>(
        "raven.api.threads.get_unread_threads",
        undefined,
        "unread_threads",
        { revalidateOnFocus: true, revalidateOnReconnect: true },
    )

    useEffect(() => {
        if (!data?.message) return
        unreadThreadsStore.reconcile(data.message.map((row) => row.name))
        // The store now holds the server's full truth — stale tray notifications
        // (for threads read on other devices) can be swept safely.
        markUnreadSeeded("threads")
    }, [data])
}
