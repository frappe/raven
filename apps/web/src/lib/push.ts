/**
 * Web push via Raven Cloud (v3+).
 *
 * v3 only supports the "Raven" (Raven Cloud) push service — the Frappe Cloud
 * relay remains for v2 clients. Raven Cloud puts the Firebase client config +
 * VAPID key straight into boot (see raven/boot.py), so unlike v2 there are no
 * network round-trips to a relay server to fetch config.
 *
 * This module replaces v2's FrappePushNotification class (frappe-push-notification.js),
 * which leaked memory: its onMessage() discarded Firebase's unsubscribe function and
 * was re-invoked on every MainPage mount, so observers piled up forever on a global
 * singleton. v3 avoids the API entirely — Firebase's ONLY job here is minting the FCM
 * token. Foreground messages are ignored (the realtime socket already handles in-app
 * notifications) and background display is done by sw.js handling raw `push` events,
 * so neither the page nor the worker ever registers an FCM message listener.
 *
 * Firebase is loaded via dynamic import only when needed (enable toggle, or startup
 * refresh for already-subscribed devices) — users who never enable push never
 * download the chunk.
 */

// v2 stored the token under this exact key (`firebase_token_${projectName}`).
// Reusing it means devices that enabled push on v2 stay "enabled" after the v3
// upgrade: the startup refresh re-mints the token and re-subscribes if it changed
// (which self-heals relay-era tokens minted under a different Firebase project).
const TOKEN_STORAGE_KEY = "firebase_token_raven"

/**
 * The registration promise is held here (not navigator.serviceWorker.ready)
 * so callers can use it before the worker controls this page — a freshly
 * registered SW only controls pages loaded AFTER it activates.
 */
let swRegistration: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null)

type FirebaseClientConfig = {
    projectId: string
    appId: string
    apiKey: string
    authDomain: string
    messagingSenderId: string
}

/** Boot-provided push config; null unless the site uses Raven Cloud. */
const getBootPushConfig = (): { config: FirebaseClientConfig; vapidKey: string } | null => {
    const boot = window.frappe?.boot
    if (boot?.push_notification_service !== "Raven") return null
    if (!boot.firebase_client_config || !boot.vapid_public_key) return null
    try {
        const config = typeof boot.firebase_client_config === "string"
            ? JSON.parse(boot.firebase_client_config)
            : boot.firebase_client_config
        return { config, vapidKey: boot.vapid_public_key }
    } catch (e) {
        console.error("Invalid firebase_client_config in boot", e)
        return null
    }
}

/** The site is on Raven Cloud and shipped us a usable client config. */
export const isRavenPushConfigured = (): boolean => getBootPushConfig() !== null

/**
 * The browser can do web push AT ALL. Notably false in iOS Safari browser tabs —
 * Apple only exposes PushManager to home-screen web apps (16.4+), so this hides
 * the toggle until the PWA is installed.
 */
export const isPushSupportedByBrowser = (): boolean =>
    "serviceWorker" in navigator && "Notification" in window && "PushManager" in window

/** Whether THIS device has push enabled (source of truth: the stored token). */
export const isPushEnabled = (): boolean => localStorage.getItem(TOKEN_STORAGE_KEY) !== null

/**
 * Running as an INSTALLED app (home screen / desktop PWA) rather than a browser
 * tab. Installation is a personal-device signal — offline persistence of user
 * data (rendered shell, boot cache) is gated on it, so shared-machine browser
 * sessions leave nothing extra at rest.
 */
export const isStandalone = (): boolean =>
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS home-screen apps report through navigator.standalone instead
    (navigator as { standalone?: boolean }).standalone === true

/** Lazily create the Firebase Messaging instance from boot config. */
const getMessagingInstance = async () => {
    const cfg = getBootPushConfig()
    if (!cfg) throw new Error("Push notifications are not configured on this site")
    const [{ initializeApp, getApps }, { getMessaging, isSupported }] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
    ])
    if (!(await isSupported())) throw new Error("Push notifications are not supported on this device")
    // initializeApp twice with the same name throws — reuse the app across calls
    const app = getApps()[0] ?? initializeApp(cfg.config)
    return { messaging: getMessaging(app), vapidKey: cfg.vapidKey }
}

/** POST to a whitelisted raven.api.notification method (plain fetch — no hook context here). */
const callNotificationAPI = async (method: "subscribe" | "unsubscribe", body: Record<string, string | undefined>) => {
    const response = await fetch(`/api/method/raven.api.notification.${method}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
            ...(window.csrf_token ? { "X-Frappe-CSRF-Token": window.csrf_token } : {}),
        },
    })
    if (!response.ok) throw new Error(`Failed to ${method} push token (${response.status})`)
}

/**
 * Register the service worker (push + offline app shell). Called once from
 * main.tsx after boot is available.
 *
 * Served at /raven/sw.js by a Frappe page renderer — NOT from /assets/ —
 * because a SW's scope is capped at its script's directory, and controlling
 * the app's pages is what enables the offline shell (and, later, share-target
 * files). The URL is static; the renderer sends Cache-Control: no-cache, so
 * deploys are picked up on the next registration check.
 */
export const registerPushServiceWorker = () => {
    if (!("serviceWorker" in navigator)) return

    // One-time migrations — every registration that isn't ours must go:
    //  - any /assets/…-scoped worker: the pre-offline v3 worker AND v2's old
    //    Firebase worker at /assets/raven/raven/sw.js. The latter is load-
    //    bearing after the URL swap: v3's sw.js is now served at that very
    //    asset path, so the browser would UPDATE the old registration to v3's
    //    code and both would handle pushes (double notifications).
    //  - the /raven_v3/-scoped worker from before the app moved to /raven.
    navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
            for (const registration of registrations) {
                const scope = new URL(registration.scope).pathname
                if (scope.startsWith("/assets/raven/") || scope.startsWith("/raven_v3")) {
                    registration.unregister()
                }
            }
        })
        .catch(() => { })

    swRegistration = navigator.serviceWorker
        .register("/raven/sw.js", { type: "classic" })
        .catch((e) => {
            console.error("Failed to register service worker", e)
            return null
        })
}

/**
 * Mint (or re-mint) the FCM token and make sure the server knows about it.
 * FCM rotates tokens, so this also runs at startup for subscribed devices.
 */
const mintAndSyncToken = async (): Promise<void> => {
    const registration = await swRegistration
    if (!registration) throw new Error("Service worker is not registered")
    const { messaging, vapidKey } = await getMessagingInstance()
    const { getToken } = await import("firebase/messaging")
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })

    const oldToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (oldToken === token) return

    // Token rotated (or first enable): drop the stale server record, register the new one.
    if (oldToken) await callNotificationAPI("unsubscribe", { fcm_token: oldToken }).catch(() => { })
    await callNotificationAPI("subscribe", {
        fcm_token: token,
        environment: "Web",
        device_information: navigator.userAgent,
    })
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/**
 * Enable push for this device. Must be called from a user gesture (the profile
 * toggle) — iOS refuses permission prompts outside one.
 *
 * @returns false if the user denied the permission prompt, true on success.
 * @throws when unsupported/unconfigured or the token/subscribe calls fail.
 */
export const enablePush = async (): Promise<boolean> => {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return false
    await mintAndSyncToken()
    return true
}

/** Disable push for this device: delete the FCM token + the server record. Best-effort. */
export const disablePush = async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) return
    // Clear local state first — the device should read "disabled" even if the
    // network calls below fail (the server token then dies as an FCM zombie).
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    try {
        const { messaging } = await getMessagingInstance()
        const { deleteToken } = await import("firebase/messaging")
        await deleteToken(messaging)
    } catch (e) {
        console.error("Failed to delete FCM token", e)
    }
    try {
        await callNotificationAPI("unsubscribe", { fcm_token: token })
    } catch (e) {
        console.error("Failed to unsubscribe push token", e)
    }
}

/**
 * All notifications currently in THIS device's system tray (empty when there's
 * no service worker). Each is tagged with its channel/thread id — and the tag
 * makes a newer notification replace the older one, so there's at most one per
 * conversation. Used to sweep out entries for already-read conversations.
 */
export const getDeliveredNotifications = async (): Promise<Notification[]> => {
    try {
        const registration = await swRegistration
        return (await registration?.getNotifications()) ?? []
    } catch {
        return []
    }
}

/**
 * Ask the service worker for the URL of a notification clicked while this page
 * was frozen (backgrounded iOS PWA) — the click-time postMessage is lost in a
 * suspended event loop, so the SW holds the URL for the page to pull on resume.
 * Consuming clears it in the SW; resolves null when nothing is pending, the SW
 * isn't active, or it doesn't answer (old SW version) within the timeout.
 */
export const consumePendingNotificationClick = (): Promise<string | null> =>
    new Promise((resolve) => {
        swRegistration
            .then((registration) => {
                const worker = registration?.active
                if (!worker) return resolve(null)
                const channel = new MessageChannel()
                const timer = setTimeout(() => resolve(null), 1000)
                channel.port1.onmessage = (event) => {
                    clearTimeout(timer)
                    resolve(event.data?.url ?? null)
                }
                worker.postMessage({ type: "raven:consume-notification-click" }, [channel.port2])
            })
            .catch(() => resolve(null))
    })

/**
 * Startup init: register the SW, then — only for devices that already enabled
 * push — refresh the (possibly rotated) FCM token off the critical path.
 */
export const initPushNotifications = () => {
    if (!isPushSupportedByBrowser()) return
    registerPushServiceWorker()

    // Installed app only: ask the SW to cache the rendered shell for offline
    // launches. Browser tabs never ask — see isStandalone for the reasoning.
    // (ready resolves once the registration has an active worker.)
    if (isStandalone()) {
        navigator.serviceWorker.ready
            .then((registration) => registration.active?.postMessage({ type: "raven:cache-shell" }))
            .catch(() => { })
    }

    if (!isPushEnabled() || !isRavenPushConfigured()) return
    if (Notification.permission !== "granted") {
        // Permission was revoked in browser settings — our token is dead.
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        return
    }
    // requestIdleCallback is missing in Safari; a timeout keeps it off first paint.
    const refresh = () => mintAndSyncToken().catch((e) => console.error("Push token refresh failed", e))
    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(refresh)
    } else {
        window.setTimeout(refresh, 3000)
    }
}
