import { useEffect } from "react"
import { channelUnreadStore } from "@stores/unread/store"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { getDeliveredNotifications } from "@lib/push"

/**
 * Removes system-tray notifications for conversations that are already read.
 *
 * The rule: a notification is stale when its tag (= channel or thread id) has
 * nothing unread in EITHER the channel store or the thread store. We sweep the
 * tray against both:
 *  - whenever either store changes (you read something here, or a read made on
 *    another device arrives via the server reconcile), and
 *  - right after each store's first authoritative server fetch (the sync hooks
 *    call markUnreadSeeded).
 *
 * The seeded flags are the one subtlety: the stores start EMPTY, so before both
 * server fetches land, every conversation briefly looks "read" — sweeping then
 * would wipe notifications the user hasn't seen. So no sweep runs until both
 * stores have their first real answer; after that they're kept live by realtime
 * events, and sweeping on any change is safe.
 */

let channelsSeeded = false
let threadsSeeded = false

const sweep = async () => {
    if (!channelsSeeded || !threadsSeeded) return
    const notifications = await getDeliveredNotifications()
    if (notifications.length === 0) return
    const unreadChannels = new Set(channelUnreadStore.getUnreadChannelIDs())
    const unreadThreads = unreadThreadsStore.getSnapshot()
    for (const notification of notifications) {
        const tag = notification.tag
        if (tag && !unreadChannels.has(tag) && !unreadThreads.has(tag)) notification.close()
    }
}

/** Called by useUnreadSync ("channels") / useUnreadThreadsSync ("threads") after a server fetch. */
export const markUnreadSeeded = (kind: "channels" | "threads") => {
    if (kind === "channels") channelsSeeded = true
    else threadsSeeded = true
    void sweep()
}

/**
 * Mounted once in AppListeners. The sweep runs on three signals:
 *  - an unread store changed — something was read, here or on another device
 *  - the worker just showed a notification — push arrives seconds after the
 *    socket, so the message may already be read and no store change is coming
 *  - the app became visible — the catch-all: a frozen phone misses the
 *    worker's signal, so the tray is reconciled on every return
 */
export const useClearReadNotifications = () => {
    useEffect(() => {
        const unsubChannels = channelUnreadStore.subscribeGlobal(() => void sweep())
        const unsubThreads = unreadThreadsStore.subscribe(() => void sweep())

        const onWorkerMessage = (event: MessageEvent) => {
            if (event.data?.type === "raven:notification-shown") void sweep()
        }
        navigator.serviceWorker?.addEventListener("message", onWorkerMessage)

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void sweep()
        }
        document.addEventListener("visibilitychange", onVisibilityChange)

        return () => {
            unsubChannels()
            unsubThreads()
            navigator.serviceWorker?.removeEventListener("message", onWorkerMessage)
            document.removeEventListener("visibilitychange", onVisibilityChange)
        }
    }, [])
}
