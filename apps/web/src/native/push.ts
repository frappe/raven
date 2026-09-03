// src/native/push.ts
import { callNotificationAPI } from "@lib/pushApi"
import { nativePlatform } from "./platform"

// localStorage key is raven- prefixed so useLogout's prefix wipe already cleans it up.
export const NATIVE_TOKEN_KEY = "raven-native-fcm-token"

export const isNativePushEnabled = () => localStorage.getItem(NATIVE_TOKEN_KEY) !== null

// @capacitor-firebase/messaging is dynamically imported so browser bundles stay
// free of Capacitor code (platform.ts reads the bridge global the same way).
const messaging = () => import("@capacitor-firebase/messaging").then((m) => m.FirebaseMessaging)

const syncToken = async (token: string) => {
    const old = localStorage.getItem(NATIVE_TOKEN_KEY)
    if (old === token) return
    if (old) await callNotificationAPI("unsubscribe", { fcm_token: old }).catch(() => { })
    await callNotificationAPI("subscribe", {
        fcm_token: token,
        environment: "Mobile",
        device_information: `${nativePlatform()} native app`,
    })
    localStorage.setItem(NATIVE_TOKEN_KEY, token)
}

export const enableNativePush = async (): Promise<boolean> => {
    const fm = await messaging()
    const { receive } = await fm.requestPermissions()
    if (receive !== "granted") return false
    const { token } = await fm.getToken()
    await syncToken(token)
    return true
}

export const disableNativePush = async (): Promise<void> => {
    const token = localStorage.getItem(NATIVE_TOKEN_KEY)
    if (!token) return
    localStorage.removeItem(NATIVE_TOKEN_KEY)
    try { await (await messaging()).deleteToken() } catch (e) { console.error("deleteToken failed", e) }
    try { await callNotificationAPI("unsubscribe", { fcm_token: token }) } catch (e) { console.error("unsubscribe failed", e) }
}

// Same precedence as sw.js notificationclick: message_url → click_action → base_url.
export const resolveNotificationTarget = (data: Record<string, string>, currentOrigin: string) => {
    const raw = data.message_url || data.click_action || data.base_url
    if (!raw) return null
    let url: URL
    try { url = new URL(raw) } catch { return null }
    if (url.origin !== currentOrigin) return { kind: "other-site" as const, url: url.href }
    const path = url.pathname.replace(/^\/raven/, "") || "/"
    return { kind: "same-site" as const, path: path + url.search + url.hash }
}

export const subscribeNotificationTaps = (handler: (data: Record<string, string>) => void): (() => void) => {
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    messaging().then(async (fm) => {
        const h = await fm.addListener("notificationActionPerformed", (e) => handler((e.notification.data ?? {}) as Record<string, string>))
        if (disposed) { h.remove().catch(() => { }); return }
        handle = h
    }).catch(() => { })
    return () => { disposed = true; handle?.remove().catch(() => { }) }
}

// Startup: refresh a rotated token for already-subscribed devices.
export const initNativePush = () => {
    if (!isNativePushEnabled()) return
    messaging().then(async (fm) => {
        const { receive } = await fm.checkPermissions()
        if (receive === "denied") { await disableNativePush(); return }   // OS revoked: kill local + server token
        if (receive !== "granted") return                                  // "prompt" is ambiguous — keep the token, skip this refresh
        // Listen BEFORE getToken so a rotation in that window is not missed.
        await fm.addListener("tokenReceived", ({ token }) => syncToken(token).catch(() => { }))
        const { token } = await fm.getToken()
        await syncToken(token)
    }).catch((e) => console.error("Native push init failed", e))
}
