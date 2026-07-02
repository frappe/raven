// Push-only service worker for v3 web. No offline caching.
// Firebase config is passed in via the ?config= query string appended by
// frappePushNotification.appendConfigToServiceWorkerURL() in main.tsx.
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js")

// OFFLINE PRECACHE — DISABLED (push-only). vite-plugin-pwa injects the precache manifest
// at self.__WB_MANIFEST. With injectManifest.globPatterns = [] it injects [], so nothing
// is precached. To enable offline asset caching later:
//   1. yarn workspace @raven/web add -D workbox-precaching
//   2. set injectManifest.globPatterns in vite.config.ts (e.g. ["**/*.{js,css,html,svg,png,woff2}"])
//   3. uncomment the import + precacheAndRoute below
// import { precacheAndRoute } from "workbox-precaching"
// precacheAndRoute(self.__WB_MANIFEST)
const _precacheManifest = self.__WB_MANIFEST // injection point; inert while globs are empty
void _precacheManifest

const jsonConfig = new URL(location).searchParams.get("config")

function isChrome() {
    return navigator.userAgent.toLowerCase().includes("chrome")
}

try {
    firebase.initializeApp(JSON.parse(jsonConfig))
    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
        const notificationTitle = payload.data.title
        const notificationOptions = {
            body: payload.data.body || "",
        }
        if (payload.data.notification_icon) {
            notificationOptions["icon"] = payload.data.notification_icon
        }
        if (payload.data.raven_message_type === "Image") {
            notificationOptions["image"] = payload.data.content
        }
        if (payload.data.creation) {
            notificationOptions["timestamp"] = payload.data.creation
        }

        const url = `${payload.data.base_url}/raven/${payload.data.channel_id}`
        if (isChrome()) {
            notificationOptions["data"] = { url: url }
        } else {
            notificationOptions["actions"] = [{ action: url, title: "View" }]
        }
        self.registration.showNotification(notificationTitle, notificationOptions)
    })

    if (isChrome()) {
        self.addEventListener("notificationclick", (event) => {
            event.stopImmediatePropagation()
            event.notification.close()
            if (event.notification.data && event.notification.data.url) {
                clients.openWindow(event.notification.data.url)
            }
        })
    }
} catch (error) {
    console.log("Failed to initialize Firebase", error)
}

self.skipWaiting()
self.clients.claim()
console.log("Service Worker Initialized")
