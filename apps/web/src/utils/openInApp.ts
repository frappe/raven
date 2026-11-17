import { isAndroid, isIOS, isStandalone } from "@utils/platform"

// "1": links on this site open in the Raven app, in this browser. "0": the offer was dismissed.
const KEY = "raven-open-in-app"
// The page goes to the background within this when the app takes over.
const TAKEOVER_MS = 2500
// Safari's own "Open in Raven?" prompt can take this long to answer; a page hidden later is something else.
const ANSWER_MS = 15_000
const PACKAGE = "raven.thecommit.company"
const PLAY_STORE = `https://play.google.com/store/apps/details?id=${PACKAGE}`

const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (value: string | null) => {
    try {
        if (value === null) localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, value)
    } catch {
        // Storage blocked (private mode): the choice just isn't kept.
    }
}

const onPhoneBrowser = () => !import.meta.env.VITE_NATIVE && (isIOS || isAndroid) && !isStandalone()

// Safari's Smart App Banner (index.html) offers the app there itself: Open, or the App Store without it.
// Other iPhone browsers add their own token (CriOS, FxiOS, …) and show no banner.
const inIOSSafari = () => isIOS && /Version\/[\d.]+.*Safari\//.test(navigator.userAgent)

/** Someone chose the app for this site's links. */
export const wantsApp = () => onPhoneBrowser() && read() === "1"

/** The app is offered until it's chosen or the offer is dismissed. */
export const offersApp = () => onPhoneBrowser() && !inIOSSafari() && read() === null

export const dismissApp = () => write("0")

/**
 * Hands this page to the app (apps/web/src/native/linkIn.ts). The choice is kept only once the page goes
 * to the background: an app that isn't installed, or a cancelled browser prompt, leaves it here.
 * `orStore`, for a tap: on Android, without the app, the Play Store opens instead. That hides the page too,
 * so the next link tries the app once, and the choice clears if it's still missing. Never for the automatic
 * hand-off, which would send someone to a store on every link.
 */
export const openInApp = ({ orStore = false } = {}) => {
    const forget = setTimeout(() => { if (!document.hidden) write(null) }, TAKEOVER_MS)
    const stop = () => {
        clearTimeout(forget)
        clearTimeout(giveUp)
        document.removeEventListener("visibilitychange", onHide)
    }
    const onHide = () => {
        if (!document.hidden) return
        stop()
        write("1")
    }
    const giveUp = setTimeout(stop, ANSWER_MS)
    document.addEventListener("visibilitychange", onHide)
    const link = `open?url=${encodeURIComponent(location.href)}`
    location.href = orStore && isAndroid
        ? `intent://${link}#Intent;scheme=raven;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end`
        : `raven://${link}`
}
