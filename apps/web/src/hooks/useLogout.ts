import { useCallback, useState } from "react"
import { useFrappeAuth, type FrappeError } from "frappe-react-sdk"
import { errorResponseToast } from "@components/ui/error-banner"
import { disablePush } from "@lib/push"
import { db } from "@db"
import _ from "@lib/translate"

/**
 * localStorage prefixes that hold app data and must not survive a logout
 * (drafts, staged uploads, preferences, last-visited pointers, the persisted
 * SWR cache, the push token). We remove by prefix instead of localStorage.clear()
 * because the origin is the whole Frappe site — Desk and other Frappe apps
 * keep their own keys here and wiping them isn't ours to do.
 */
const LOCAL_STORAGE_PREFIXES = [
    "app-cache", // + app-cache-timestamp (persisted SWR cache)
    "raven-", // drafts (raven-draft-*), quick emojis, enter-key, image layout, double-tap reaction
    "ravenLast", // ravenLastWorkspace / ravenLastChannel
    "uploaded-files-", // staged composer attachments per channel
    "firebase_token_", // push token (already unsubscribed by disablePush, this is belt-and-braces)
    "emoji-mart", // emoji-mart's own frequently-used tracking (emoji-mart.last / .frequently)
]

/** Device-level appearance, not user data — keep it so login doesn't flash themes. */
const LOCAL_STORAGE_KEEP = ["raven-theme"]

const clearLocalStorage = () => {
    // Collect first — removing while iterating shifts localStorage's key index.
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || LOCAL_STORAGE_KEEP.includes(key)) continue
        if (LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) doomed.push(key)
    }
    doomed.forEach((key) => localStorage.removeItem(key))
}

/**
 * Best-effort IndexedDB wipe, bounded so a blocked deletion can't stall logout.
 * RavenDB goes through Dexie (it closes its own connection first, so the delete
 * isn't blocked by our live hooks); the Firebase databases are just FCM caches
 * (the token itself was already deleted via the FCM API in disablePush).
 */
const clearIndexedDB = async () => {
    const deleteRawDB = (name: string) =>
        new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name)
            // onblocked: another tab holds a connection — deletion completes once
            // it closes; nothing to wait for here.
            request.onsuccess = request.onerror = request.onblocked = () => resolve()
        })

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000))
    await Promise.race([
        Promise.allSettled([
            db.delete(),
            deleteRawDB("firebase-messaging-database"),
            deleteRawDB("firebase-installations-database"),
            deleteRawDB("firebase-heartbeat-database"),
        ]),
        timeout,
    ])
}

/**
 * Logs the user out and returns them to Frappe's login page, with redirect-to
 * pointing back at this app so logging in again lands in Raven.
 *
 * Order matters:
 * 1. Unsubscribe push — needs the still-authenticated session.
 * 2. Server logout — if THIS fails we stop and keep all local state.
 * 3. Wipe local data (localStorage + IndexedDB) — only after the session is
 *    truly dead, so a failed logout doesn't leave a logged-in app with no cache.
 * 4. Hard redirect — kills the socket, SWR's in-memory cache and all stores.
 *    (localStorageProvider's beforeunload writer also sees the Guest cookie and
 *    skips re-persisting the cache.)
 */
export function useLogout(): { logout: () => Promise<void>; isLoggingOut: boolean } {
    const { logout: frappeLogout } = useFrappeAuth()
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const logout = useCallback(async () => {
        setIsLoggingOut(true)

        // Best-effort: stop this device receiving pushes for a logged-out session.
        try {
            await disablePush()
        } catch (e) {
            console.error("Failed to disable push notifications on logout", e)
        }

        try {
            await frappeLogout()
        } catch (e) {
            setIsLoggingOut(false)
            errorResponseToast(_("Could not log out"), e as FrappeError)
            return
        }

        clearLocalStorage()
        await clearIndexedDB()
        // The offline app-shell cache holds a RENDERED page — this user's boot
        // and csrf_token baked into the HTML. A logged-out device must not keep
        // it. Same for the sw.js image caches: raven-media holds /private/files
        // content that must not outlive the session on a shared machine, and
        // raven-avatars goes too so logout clears everything Raven wrote. The
        // precache (public build assets) is user-independent and stays.
        try {
            await caches.delete("raven-app-shell")
            await caches.delete("raven-avatars")
            await caches.delete("raven-media")
            // Unconsumed notification-click URL (sw.js pending-click store).
            await caches.delete("raven-pending-click")
        } catch {
            // Cache API unavailable (older browser) — nothing was cached either.
        }
        // A logged-out device claims no unread.
        navigator.clearAppBadge?.().catch(() => { })

        const base = import.meta.env.VITE_BASE_NAME
        const appPath = base ? `/${base}` : "/"
        window.location.replace(`/login?redirect-to=${encodeURIComponent(appPath)}`)
    }, [frappeLogout])

    return { logout, isLoggingOut }
}
