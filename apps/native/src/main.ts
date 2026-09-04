import { SplashScreen } from "@capacitor/splash-screen"
import { armSplashFallback } from "./splash"
import { FirebaseMessaging } from "@capacitor-firebase/messaging"
import { Preferences } from "@capacitor/preferences"
import { reauth, signOut } from "./auth"
import { getDefaultSite, loadSites, setDefaultSite } from "./sites"
import { captureShareIntent } from "./shareIntake"
import { SHARE_TARGET_PATH } from "@raven/lib/utils/shareIntent"
import { APP_THEME_KEY, LAST_AUTO_NAV_KEY } from "@raven/lib/utils/nativeKeys"
import { renderPicker, setPickerRedirect, showError } from "./picker"
import { themeClass } from "./theme"
import { registerPickerBack } from "./back"

const root = document.getElementById("app")!
const AUTO_NAV_GAP_MS = 15000

const boot = async () => {
    armSplashFallback(8000)
    // In-app theme choice outranks the system theme on the picker too.
    const theme = await Preferences.get({ key: APP_THEME_KEY }).catch(() => ({ value: null }))
    const override = themeClass(theme.value)
    if (override) document.documentElement.classList.add(override)
    // The picker is the persistent floor; it sits behind the splash while we decide.
    await renderPicker(root)
    registerPickerBack()

    // Shell URLs from the web app: ?signout= clears the token, then shows the picker.
    const params = new URLSearchParams(location.search)
    const signout = params.get("signout")
    if (signout) {
        await signOut(signout)
        // The signed-out site must not become the auto-open target on the next launch.
        await setDefaultSite(null)
    }
    // ?relogin= is a user-visible recovery, so it skips the 15 s auto-nav guard.
    const relogin = params.get("relogin")
    if (relogin) {
        // Both sides are URL origins (normalizeSiteUrl / window.location.origin), so exact match is safe.
        const site = (await loadSites()).find((s) => s.url === relogin)
        if (!site) {
            await SplashScreen.hide().catch(() => { })
            showError("Unknown site.")
            return
        }
        // Arms the 15 s guard: if login_with_token rejects, the next launch falls back to the picker.
        await Preferences.set({ key: LAST_AUTO_NAV_KEY, value: String(Date.now()) })
        await reauth(relogin, params.get("to") || "/raven", site.clientId)
        return
    }
    if (signout) {
        await SplashScreen.hide().catch(() => { })
        return
    }

    // A tap that launched the app fires before any page listens; capture it here.
    // Cold-start taps arrive within a few ms; 300 ms bounds the wait.
    const tapPromise = new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 300)
        FirebaseMessaging.addListener("notificationActionPerformed", (e) => {
            clearTimeout(timer)
            const d = (e.notification.data ?? {}) as Record<string, string>
            resolve(d.message_url || d.click_action || d.base_url || null)
        })
    })
    const tapped = await tapPromise
    // Re-entering within 15 s means the site didn't load — fall back to the picker.
    const { value: lastAutoNav } = await Preferences.get({ key: LAST_AUTO_NAV_KEY })
    const recent = !!lastAutoNav && Date.now() - Number(lastAutoNav) < AUTO_NAV_GAP_MS
    const go = async (url: string): Promise<boolean> => {
        if (recent) return false
        await Preferences.set({ key: LAST_AUTO_NAV_KEY, value: String(Date.now()) })
        window.location.href = url
        return true
    }
    let hadTarget = false
    // Tap → share intake → defaultSite, in that order.
    if (tapped) { hadTarget = true; if (await go(tapped)) return }
    if (await captureShareIntent()) {
        const site = await getDefaultSite()
        if (site) { hadTarget = true; if (await go(`${site}${SHARE_TARGET_PATH}`)) return }
        // Not delivered (no site yet, or the site failed to load): whichever site the
        // user opens from the picker opens the share target instead of /raven.
        setPickerRedirect(SHARE_TARGET_PATH)
    }
    const site = await getDefaultSite()
    if (site) { hadTarget = true; if (await go(`${site}/raven`)) return }

    await SplashScreen.hide().catch(() => { })
    if (recent && hadTarget) {
        showError("Could not open your site. Pick it again or add another.")
    }
}
boot().catch(async () => {
    await SplashScreen.hide().catch(() => { })
    renderPicker(root)
})
