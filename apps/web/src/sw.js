// Push-only service worker for v3 web. No offline caching, and — unlike v2 —
// NO Firebase: Raven Cloud sends data-only FCM messages, which arrive here as
// standard Web Push events. firebase-messaging-sw's only jobs (parse payload,
// skip display when a tab is visible, show the notification) are ~40 lines, so
// we do them ourselves. That removes the CDN importScripts and the ?config=
// query-string dance — the SW URL is static, so it updates purely on code change.
//
// CONTRACT: the server must keep pushes DATA-ONLY (title/body inside `data`).
// A top-level `notification` key would rely on FCM SDK auto-display we no
// longer have.

import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { CacheFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"

// OFFLINE APP SHELL. The SW is served at /raven/sw.js (see raven/
// page_renderers.py) so its scope covers the app's pages — a SW can only
// intercept fetches from clients it controls.
//
// 1. Precache the build output (manifest injected by vite-plugin-pwa at
//    __WB_MANIFEST; URLs prefixed to /assets/raven/raven/ in vite.config).
// 2. App navigations are NETWORK-FIRST — online loads must keep hitting the
//    Jinja route (fresh boot + csrf_token). Offline falls back to the cached
//    shell — a fully RENDERED page with real boot — and, as a last resort, the
//    precached BUILT index.html, whose Jinja is unrendered (its inline boot
//    script fails; main.tsx then recovers boot from localStorage).
//
//    The shell is cached ONLY when an installed (standalone) app asks for it
//    (raven:cache-shell below) — the SW can't see display mode itself, and a
//    plain browser-tab session shouldn't leave a rendered page (user's boot +
//    csrf baked in) at rest on what may be a shared machine. Installation is
//    a personal-device signal.
precacheAndRoute(self.__WB_MANIFEST)

const APP_SHELL_CACHE = "raven-app-shell"
const APP_SHELL_KEY = "/raven/"

registerRoute(
    new NavigationRoute(
        async ({ request, event }) => {
            try {
                return await fetch(request)
            } catch {
                const cached = await caches.match(APP_SHELL_KEY)
                if (cached) return cached
                return createHandlerBoundToURL("/assets/raven/raven/index.html")({ request, event })
            }
        },
        // Only the app's own routes — /app (desk), /api, /raven_v2 (the old
        // app) etc. stay untouched.
        { allowlist: [/^\/raven(\/|$)/] },
    ),
)

// UPLOADED IMAGES: cache-first with entry caps. Two reasons these routes exist:
//  - Safari gives SW pass-through requests degraded HTTP-cache treatment, so on
//    a controlled page it re-downloaded every avatar on every channel switch —
//    answering from the SW cache sidesteps that entirely.
//  - It's the first slice of offline media (offline plan, SW media caching).
// Scoped to `destination === "image"` — videos must NOT match (range requests
// don't play well with CacheFirst) and non-image files aren't worth the quota.
// Uploaded files are immutable in practice (an edit produces a new URL), so
// cache-first staleness is safe; the TTLs are garbage collection (orphaned URLs
// after avatar changes / deletions), not freshness. Both wiped on logout.
//
// TWO caches, split by path, because the populations have opposite economics
// and a shared LRU lets one starve the other: scrolling a photo-heavy channel
// would flush every avatar out of a combined cache.
//  - /files/          → avatars (uploads are forced public): tiny, high-reuse.
//  - /private/files/  → message images (upload_file.py forces is_private=1):
//    multi-MB, low-reuse — and the cache that must never outlive the session.
const AVATAR_CACHE = "raven-avatars"
const MEDIA_CACHE = "raven-media"

const imageRoute = (pathPrefix) => ({ request, url }) =>
    request.destination === "image" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(pathPrefix)

registerRoute(
    imageRoute("/files/"),
    new CacheFirst({
        cacheName: AVATAR_CACHE,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days — lazy GC only
                // If the cache write ever fails on a full disk, evict and retry.
                purgeOnQuotaError: true,
            }),
        ],
    }),
)

registerRoute(
    imageRoute("/private/files/"),
    new CacheFirst({
        cacheName: MEDIA_CACHE,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 150,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true,
            }),
        ],
    }),
)

/** Fetch + cache the rendered shell — requested by standalone pages only. */
async function cacheAppShell() {
    try {
        const response = await fetch(APP_SHELL_KEY)
        // Only real app HTML: a redirect-following fetch can land on the login
        // page (response.ok!) — caching that would make the offline "app" a
        // login screen.
        if (response.ok && new URL(response.url).pathname.startsWith("/raven")) {
            const cache = await caches.open(APP_SHELL_CACHE)
            await cache.put(APP_SHELL_KEY, response)
        }
    } catch {
        // Offline / fetch failed — keep whatever shell we already have.
    }
}

/**
 * Fallback badge when the server didn't send an authoritative unread_count:
 * count DISTINCT notification tags still on display (we tag per channel, so
 * that's "unread conversations delivered while away"). Self-correcting — tags
 * drop out as notifications are opened/dismissed — and the page takes over
 * with exact store counts whenever the app is running. `excludeTag` covers
 * click/close handlers, where the acted-on notification may still be listed.
 */
async function updateBadgeFromNotifications(excludeTag) {
    if (typeof navigator.setAppBadge !== "function") return
    const notifications = await self.registration.getNotifications()
    const tags = new Set()
    let untagged = 0
    for (const notification of notifications) {
        if (!notification.tag) untagged++
        else if (notification.tag !== excludeTag) tags.add(notification.tag)
    }
    const count = tags.size + untagged
    if (count > 0) await navigator.setAppBadge(count)
    else await navigator.clearAppBadge()
}

// Apple platforms revoke a push subscription after a few pushes that show no
// notification ("silent" pushes, their anti-spam rule). So on Apple, EVERY
// push must end in showNotification — even ones we'd rather swallow. Chrome
// has no such rule, so other platforms keep the quieter behavior.
const isApplePlatform = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent)

/** Last-resort notification for pushes we can't read — shown on Apple so the
 *  push still counts as "shown" and the subscription survives. */
const showFallbackNotification = () =>
    self.registration.showNotification("Raven", { body: "You have a new message" })

self.addEventListener("push", (event) => {
    // FCM wraps the message as { data: {...}, from, priority, ... }
    let payload = null
    try {
        payload = event.data ? event.data.json() : null
    } catch {
        // Unreadable payload — handled below (Apple still shows a fallback).
    }
    const data = payload?.data ?? {}

    event.waitUntil(
        (async () => {
            if (!payload) {
                if (isApplePlatform) await showFallbackNotification()
                return
            }

            // If the app is visible in some window, the realtime socket already
            // surfaced this message in-app — a system notification on top would
            // double-notify, so Chrome and friends skip it (same as
            // firebase-messaging-sw). Apple can't skip (see isApplePlatform):
            // there the notification shows anyway, and the read-sweep
            // (raven:notification-shown → useClearReadNotifications) clears it
            // moments later once the message is read. includeUncontrolled
            // covers pages loaded before this SW version activated.
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
            if (!isApplePlatform && windows.some((client) => client.visibilityState === "visible")) return

            // Authoritative badge count, when the server includes it. The page
            // mirrors the badge itself while running — this covers the closed/
            // suspended states, and each arriving push re-syncs the count
            // (correcting for messages read on other devices in between).
            const serverCount = data.unread_count !== undefined ? Number(data.unread_count) : NaN
            if (typeof navigator.setAppBadge === "function" && Number.isFinite(serverCount)) {
                if (serverCount > 0) navigator.setAppBadge(serverCount)
                else navigator.clearAppBadge()
            }

            // Raven Cloud flattens title/body into `data` for web pushes; the
            // notification-key fallback covers older payload shapes.
            const title = data.title || payload?.notification?.title
            if (!title) {
                if (isApplePlatform) await showFallbackNotification()
                return
            }

            /** @type {NotificationOptions} */
            const options = {
                body: data.body || payload?.notification?.body || "",
                // One notification per channel: a newer push replaces the older
                // one instead of stacking (matches the server's `tag` intent).
                tag: data.channel_id || undefined,
                // Fully-formed by the server (handles workspaces + threads).
                data: { url: data.message_url || data.click_action || data.base_url },
            }
            const icon = data.notification_icon || data.image
            if (icon) options.icon = icon
            if (data.raven_message_type === "Image" && data.content) options.image = data.content
            if (data.creation) options.timestamp = Number(data.creation)

            await self.registration.showNotification(title, options)
            // No server count → approximate from what's now on display.
            if (!Number.isFinite(serverCount)) await updateBadgeFromNotifications()
            // Tell open pages a notification landed, so they can sweep the
            // tray now. Push arrives seconds after the socket — the user may
            // have already read this message, and then nothing else would
            // trigger a sweep to remove it.
            const pages = await self.clients.matchAll({ type: "window" })
            for (const page of pages) page.postMessage({ type: "raven:notification-shown" })
        })(),
    )
})

// Swiped-away notifications should drop out of the fallback badge count.
// (Fires only where supported; the acted-on notification may still be listed,
// hence the exclude.)
self.addEventListener("notificationclose", (event) => {
    event.waitUntil(updateBadgeFromNotifications(event.notification.tag))
})

// The browser replaced or dropped this device's push subscription (token
// rotation, or Apple ending it over silent pushes). The worker can't mint a
// new FCM token itself (that needs the Firebase SDK, which lives in the
// page) — so tell any open page to re-register right now. A closed app
// heals on its next launch: startup always re-mints and syncs the token.
self.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil(
        (async () => {
            const pages = await self.clients.matchAll({ type: "window" })
            for (const page of pages) page.postMessage({ type: "raven:push-subscription-changed" })
        })(),
    )
})

// The URL of the last clicked notification, held until the page asks for it.
//
// Why: when the app is backgrounded on iOS, its JS is frozen. The postMessage
// we send at click time lands in that frozen event loop and is lost. So the
// page also PULLS the URL when it wakes up (raven:consume-notification-click).
// Reading it clears it, so a click never navigates twice.
//
// It lives in the Cache API, not a variable. The OS can kill this worker in
// the seconds it takes the page to wake — a variable would come back empty
// and the click would be lost. Storage survives the worker.
const PENDING_CLICK_CACHE = "raven-pending-click"
const PENDING_CLICK_KEY = "/__pending-notification-click"

async function setPendingClick(url) {
    try {
        const cache = await caches.open(PENDING_CLICK_CACHE)
        await cache.put(PENDING_CLICK_KEY, new Response(url))
    } catch {
        // Storage unavailable — the live postMessage path still works.
    }
}

/** Read + clear (one consumer gets it, repeats get null). */
async function takePendingClick() {
    try {
        const cache = await caches.open(PENDING_CLICK_CACHE)
        const hit = await cache.match(PENDING_CLICK_KEY)
        if (!hit) return null
        await cache.delete(PENDING_CLICK_KEY)
        return await hit.text()
    } catch {
        return null
    }
}

self.addEventListener("message", (event) => {
    if (event.data?.type === "raven:consume-notification-click") {
        const port = event.ports[0]
        event.waitUntil?.(takePendingClick().then((url) => port?.postMessage({ url })))
    }
    if (event.data?.type === "raven:cache-shell") {
        event.waitUntil?.(cacheAppShell())
    }
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const url = event.notification.data?.url
    if (!url) return

    event.waitUntil(
        (async () => {
            // The clicked channel is being addressed — drop its tag from the
            // fallback badge. (The page re-syncs the exact count on focus.)
            await updateBadgeFromNotifications(event.notification.tag)
            // Store the URL before anything else — the page pulls it when it
            // wakes up, whichever branch below runs.
            await setPendingClick(url)
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
            const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
            if (existing) {
                // Hand the page the target URL rather than navigate() (a full
                // reload, and illegal for yet-uncontrolled clients anyway). Two
                // delivery paths:
                //  - postMessage: instant, works when the page is live (desktop/Android)
                //  - the pending-click store: pulled by the page on resume,
                //    covering the frozen-PWA case where the postMessage is lost
                await existing.focus()
                existing.postMessage({ type: "raven:notification-click", url })
            } else {
                await self.clients.openWindow(url)
            }
        })(),
    )
})

// Activate updated SW versions immediately — there are no in-flight caches to
// coordinate. clients.claim() is pointless here (our scope controls no pages).
self.skipWaiting()
