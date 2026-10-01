import { siteFetch, siteKey, siteOrigin } from "@lib/site"
import { refreshTokens } from "./auth"
import { inAppPath } from "./links"
import { pendingPath } from "./pending"
import { listenNative, nativePlatform, withPrefs } from "./platform"
import { ravenShell } from "./shell"
import { loadSites, setDefaultSite, type Site } from "./sites"

/** Site-scoped localStorage key of the FCM token this site is subscribed with. */
export const NATIVE_TOKEN_KEY = "raven-native-fcm-token"

/** Preferences key mirroring the token per site, for unsubscribing a site removed in the picker. */
const pushTokenKey = (origin: string) => `pushToken.${origin}`

/** A site taken off the device asks for nothing when it comes back. */
export const forgetPushPreference = (url: string) => withPrefs((p) => p.remove({ key: pushWantedKey(url) }))

/** Preferences key remembering that a site had push on, which a sign-out leaves behind. */
const pushWantedKey = (origin: string) => `pushWanted.${origin}`
const rememberPush = (wanted: boolean) => {
    const key = pushWantedKey(siteOrigin())
    return withPrefs((p) => (wanted ? p.set({ key, value: "1" }) : p.remove({ key })))
}

const isNativePushEnabled = () => localStorage.getItem(siteKey(NATIVE_TOKEN_KEY)) !== null

// Registered once; the proxy is wrapped because a promise resolved with it never settles.
let messagingPromise: Promise<{ fm: typeof import("@capacitor-firebase/messaging").FirebaseMessaging }> | undefined
const messaging = () =>
    (messagingPromise ??= import("@capacitor-firebase/messaging").then((m) => ({ fm: m.FirebaseMessaging })))

const callNotificationAPI = async (method: "subscribe" | "unsubscribe", body: Record<string, string>) => {
    const response = await siteFetch(`/api/method/raven.api.notification.${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Failed to ${method} push token (${response.status})`)
}

const mirrorToken = (token: string | null) => {
    const key = pushTokenKey(siteOrigin())
    return withPrefs((p) => (token ? p.set({ key, value: token }) : p.remove({ key })))
}

// Serialised: a rotation event and getToken can report the same token together.
// A failed sync is dropped from the chain so the next one still runs.
let syncing: Promise<void> = Promise.resolve()
export const syncToken = (token: string) => (syncing = syncing.catch(() => { }).then(() => subscribeToken(token)))

const subscribeToken = async (token: string) => {
    const old = localStorage.getItem(siteKey(NATIVE_TOKEN_KEY))
    if (old === token) return
    // Two rows, two requests, no order between them: a rotation costs one round trip, not two.
    await Promise.all([
        old ? callNotificationAPI("unsubscribe", { fcm_token: old }).catch(() => { }) : undefined,
        callNotificationAPI("subscribe", { fcm_token: token, environment: "Mobile", device_information: `${nativePlatform()} native app` }),
    ])
    localStorage.setItem(siteKey(NATIVE_TOKEN_KEY), token)
    await mirrorToken(token).catch(() => { })
}

export const enableNativePush = async (): Promise<boolean> => {
    const { fm } = await messaging()
    const { receive } = await fm.requestPermissions()
    if (receive !== "granted") return false
    const { token } = await fm.getToken()
    await syncToken(token)
    await rememberPush(true).catch(() => { })
    return true
}

/** `keep` when the site is only being signed out of: signing in again turns push back on. */
export const disableNativePush = async (keep = false): Promise<void> => {
    if (!keep) await rememberPush(false).catch(() => { })
    const token = localStorage.getItem(siteKey(NATIVE_TOKEN_KEY))
    if (!token) return
    localStorage.removeItem(siteKey(NATIVE_TOKEN_KEY))
    await mirrorToken(null).catch(() => { })
    // Server row only: the device token is shared by every site signed in on this device.
    try { await callNotificationAPI("unsubscribe", { fcm_token: token }) } catch (e) { console.error("unsubscribe failed", e) }
}

/** Picker removal of a site that is not the active one: a fresh bearer, one native POST, best effort. */
export const unsubscribeSitePush = async (site: Site, bearer?: string): Promise<void> => {
    try {
        const key = pushTokenKey(site.url)
        const { value: token } = await withPrefs((p) => p.get({ key }))
        if (!token) return
        await withPrefs((p) => p.remove({ key }))
        // A caller that has already forgotten the tokens passes the bearer it kept.
        const accessToken = bearer ?? (await refreshTokens(site.url, site.clientId)).accessToken
        const { CapacitorHttp } = await import("@capacitor/core")
        await CapacitorHttp.post({
            url: `${site.url}/api/method/raven.api.notification.unsubscribe`,
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            data: { fcm_token: token },
            connectTimeout: 8000,
            readTimeout: 8000,
        })
    } catch {
        // The token dies as an FCM zombie on the server; the site's sign-out follows anyway.
    }
}

// Same precedence as sw.js notificationclick: message_url → click_action → base_url.
export const resolveNotificationTarget = (data: Record<string, string>, currentOrigin: string) => {
    const raw = data.message_url || data.click_action || data.base_url
    if (!raw) return null
    let url: URL
    try { url = new URL(raw) } catch { return null }
    // The payload is server data; only web URLs may be assigned to location.
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (url.origin !== currentOrigin) return { kind: "other-site" as const, url: url.href }
    const path = url.pathname.replace(/^\/raven/, "") || "/"
    return { kind: "same-site" as const, path: path + url.search + url.hash }
}

/** Tap: the open site navigates; another saved site becomes the default, its path carried over the reload. */
export const openNotificationTarget = async (data: Record<string, string>, navigate: (path: string) => void) => {
    const target = resolveNotificationTarget(data, siteOrigin())
    if (!target) return
    if (target.kind === "same-site") return navigate(target.path)
    const origin = new URL(target.url).origin
    if (!(await loadSites()).some((s) => s.url === origin)) return
    await pendingPath.set(inAppPath(target.url, origin, "raven") ?? "/")
    await setDefaultSite(origin)
    window.location.replace("/")
}

export const subscribeNotificationTaps = (handler: (data: Record<string, string>) => void): (() => void) =>
    listenNative(async () => (await messaging()).fm.addListener("notificationActionPerformed", (e) =>
        handler((e.notification.data ?? {}) as Record<string, string>)))

// Channel id of a tray entry for the site at `hostname`. Android reports the tag (`<host>:<channel>`);
// iOS reports the payload, whose site URL is checked instead. Another site's entry maps to undefined.
export const trayChannelId = (tag: string | null | undefined, data: Record<string, string>, hostname: string) => {
    if (tag) return tag.startsWith(`${hostname}:`) ? tag.slice(hostname.length + 1) : undefined
    try {
        return new URL(data.base_url || data.message_url).hostname === hostname ? data.channel_id : undefined
    } catch {
        return undefined
    }
}

/** Tray entries in the shape the read sweep uses. */
export const getNativeDeliveredNotifications = async () => {
    const { fm } = await messaging()
    const { notifications } = await fm.getDeliveredNotifications()
    const hostname = new URL(siteOrigin()).hostname
    return notifications.map((n) => ({
        tag: trayChannelId(n.tag, (n.data ?? {}) as Record<string, string>, hostname),
        close: () => { fm.removeDeliveredNotifications({ notifications: [n] }).catch(() => { }) },
    }))
}

// A foreground push is handed to the page, not shown (presentationOptions []). Re-post the ones
// from another saved site through the shell; the open site's own messages arrive through realtime.
/** Tells the shell the page is handling pushes, so the app's own service stands down meanwhile. */
export const watchNotifications = async (watching: boolean) => {
    const { plugin } = await ravenShell()
    await plugin.watchNotifications({ watching }).catch(() => { })
}

export const subscribeForeignSiteNotifications = (): (() => void) =>
    listenNative(async () => (await messaging()).fm.addListener("notificationReceived", async ({ notification }) => {
        // Only while the page is on screen: out of sight, Android's notification service draws this push.
        if (document.visibilityState !== "visible") return
        const data = (notification.data ?? {}) as Record<string, string>
        const target = resolveNotificationTarget(data, siteOrigin())
        if (target?.kind !== "other-site") return
        const { plugin: shell } = await ravenShell()
        const site = new URL(target.url).hostname
        // Same tag form as the relay's, so the other site's sweep can clear it.
        const tag = data.channel_id ? `${site}:${data.channel_id}` : undefined
        // The app's own push carries its wording in the data; a device-drawn one has the site on its title.
        const title = data.push_title ?? (notification.title ?? "").replace(/ · [^·]+$/, "")
        const body = data.push_body ?? notification.body
        await shell.showNotification({ title, body, site, image: data.image || undefined, tag, data })
    }))

/** Startup: refresh a rotated token for a site that already subscribed. */
/** Push a site had on before a sign-out, which this device may still have permission for. */
const pushWanted = async () => {
    const { value } = await withPrefs((p) => p.get({ key: pushWantedKey(siteOrigin()) }))
    return value === "1"
}

export const initNativePush = () => {
    if (!isNativePushEnabled()) {
        // Signing in again picks up where the sign-out left off, and never asks: an unanswered
        // permission would be a prompt nobody opened settings for.
        void pushWanted().then(async (wanted) => {
            if (!wanted) return
            const { fm } = await messaging()
            const { receive } = await fm.checkPermissions()
            if (receive === "granted") await enableNativePush()
        }).catch(() => { })
        return
    }
    messaging().then(async ({ fm }) => {
        const { receive } = await fm.checkPermissions()
        if (receive === "denied") { await disableNativePush(); return }
        if (receive !== "granted") return
        // Listen before getToken so a rotation in that window is not missed.
        await fm.addListener("tokenReceived", ({ token }) => syncToken(token).catch(() => { }))
        const { token } = await fm.getToken()
        await syncToken(token)
    }).catch((e) => console.error("Native push init failed", e))
}
