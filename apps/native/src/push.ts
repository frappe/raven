import { CapacitorHttp } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"
import { pushTokenKey } from "@raven/lib/utils/nativeKeys"
import { tokenStore } from "./auth"

export type PushDeps = {
    pushToken: (site: string) => Promise<string | null>
    clearPushToken: (site: string) => Promise<void>
    accessToken: (site: string) => Promise<string | null>
    post: (url: string, body: Record<string, string>, bearer: string) => Promise<{ status: number }>
}

export const defaultPushDeps: PushDeps = {
    pushToken: async (site) => (await Preferences.get({ key: pushTokenKey(site) })).value,
    clearPushToken: (site) => Preferences.remove({ key: pushTokenKey(site) }),
    accessToken: async (site) => (await tokenStore.get(site))?.accessToken ?? null,
    post: async (url, body, bearer) => {
        const res = await CapacitorHttp.post({
            url,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
            data: body,
        })
        return { status: res.status }
    },
}

/**
 * Drops the server-side push row of a site being removed. The web app mirrors its
 * FCM token per site (apps/web/src/native/push.ts); the OAuth access token is the
 * only credential the shell holds, so site-login-only sites keep their row.
 */
export const unsubscribeSitePush = async (site: string, deps: PushDeps = defaultPushDeps) => {
    const token = await deps.pushToken(site)
    if (!token) return
    const bearer = await deps.accessToken(site)
    if (!bearer) return
    try {
        await deps.post(`${site}/api/method/raven.api.notification.unsubscribe`, { fcm_token: token }, bearer)
    } catch {
        // Best effort; the mirrored token is stale once the site is gone either way.
    }
    await deps.clearPushToken(site)
}
