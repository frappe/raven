// Site links a phone's browser hands over: `raven://open?url=<link>` (the web app's OpenInApp), or the page from Safari's Smart App Banner.
import { siteOrigin } from "@lib/site"
import { pendingLink } from "./pending"
import { listenNative, nativePlatform } from "./platform"
import { openNotificationTarget, resolveNotificationTarget } from "./push"
import { loadSites, setDefaultSite } from "./sites"

// Every link handled this session, kept over reloads: getLaunchUrl answers the same one again after each
// (the launch link on Android, the latest link on iOS).
const HANDLED_KEY = "raven-handled-links"

const handledLinks = (): string[] => {
    try { return JSON.parse(sessionStorage.getItem(HANDLED_KEY) ?? "[]") as string[] } catch { return [] }
}

/** The session's handled links with one more; none is ever dropped, so none can replay. */
export const withHandled = (handled: string[], appUrl: string): string[] =>
    handled.includes(appUrl) ? handled : [...handled, appUrl]

const markHandled = (appUrl: string) => sessionStorage.setItem(HANDLED_KEY, JSON.stringify(withHandled(handledLinks(), appUrl)))

// iOS also holds the launch link for the first appUrlOpen listener. Boot has opened it already.
const LAUNCH_ECHO_KEY = "raven-launch-echo"

/** Whether an event only repeats the launch link boot opened. True once: a later tap on it is real. */
export const skipsLaunchEcho = (appUrl: string, echo: string | null) => appUrl === echo

/**
 * The site link in an address the app was opened with: `raven://open?url=<link>` from the web app, or the
 * page itself from Safari's Smart App Banner. Null for anything else, shares (`raven://?…`) included.
 */
export const linkFromAppUrl = (appUrl: string): string | null => {
    if (/^https?:\/\//i.test(appUrl)) return appUrl
    const query = /^raven:\/\/open\/?\?(.*)$/.exec(appUrl)?.[1]
    const link = query ? new URLSearchParams(query).get("url") : null
    return link && /^https?:\/\//i.test(link) ? link : null
}

/** Links that arrive while the app runs. The one it was launched with is boot's, through routeLaunchLink. */
export const subscribeSiteLinks = (open: (link: string) => void): (() => void) =>
    listenNative(async () => (await import("@capacitor/app")).App.addListener("appUrlOpen", ({ url }) => {
        if (skipsLaunchEcho(url, sessionStorage.getItem(LAUNCH_ECHO_KEY))) return sessionStorage.removeItem(LAUNCH_ECHO_KEY)
        const link = linkFromAppUrl(url)
        if (!link) return
        markHandled(url)
        open(link)
    }))

/**
 * Boot, before the default site loads: a link the app was opened with picks the site to open, a saved
 * site's or the picker. The default site may be down, and the link's site is the one wanted anyway.
 * The page follows once that site is open (followPendingLink), or the picker offers the site to add.
 */
export const routeLaunchLink = async () => {
    const { App } = await import("@capacitor/app")
    const launch = (await App.getLaunchUrl().catch(() => undefined))?.url
    if (!launch || handledLinks().includes(launch)) return
    markHandled(launch)
    const link = linkFromAppUrl(launch)
    if (!link) return
    if (nativePlatform() === "ios") sessionStorage.setItem(LAUNCH_ECHO_KEY, launch)
    await pendingLink.set(link)
    const origin = new URL(link).origin
    await setDefaultSite((await loadSites()).some((s) => s.url === origin) ? origin : null)
}

/** Whether a link is for the open site, another saved one, or a site to add. */
export const linkAction = (link: string, current: string | null, saved: string[]): "here" | "switch" | "add" => {
    const origin = new URL(link).origin
    if (origin === current) return "here"
    return saved.includes(origin) ? "switch" : "add"
}

/** A link to this site navigates; to another saved site, that site opens on it; to any other, the picker offers it. */
export const openSiteLink = async (link: string, navigate: (path: string) => void) => {
    if (linkAction(link, siteOrigin(), (await loadSites()).map((s) => s.url)) !== "add") {
        return openNotificationTarget({ message_url: link }, navigate)
    }
    await pendingLink.set(link)
    await setDefaultSite(null)
    window.location.replace("/")
}

/** Once a site opens: the page of the link that led here, if the user signed in to that link's site. */
export const followPendingLink = async (navigate: (path: string) => void) => {
    const link = await pendingLink.take()
    const target = link ? resolveNotificationTarget({ message_url: link }, siteOrigin()) : null
    if (target?.kind === "same-site") navigate(target.path)
}
