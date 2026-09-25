import { StrictMode, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { FrappeConfig } from "frappe-react-sdk"
import { ThemeProvider } from "@components/theme-provider"
import { setActiveSite } from "@lib/site"
import { loadBoot } from "./appBoot"
import { NativeSocket } from "./nativeSocket"
import { BootErrorScreen } from "./BootErrorScreen"
import { onRequestError, reloginAt, setSessionLostHandler, setTokenRefreshedHandler, startSession } from "./session"
import { getDefaultSite, loadSites, refreshSite } from "./sites"
import { SitePicker } from "./SitePicker"
import { hideNativeSplash } from "./splash"
import { initNativePush } from "./push"

// A site that does not answer holds boot for its timeouts. Past this the page says so and
// offers the way out. Longer than a healthy open on a slow network, shorter than the first timeout.
const SLOW_BOOT_MS = 6000
let slowBoot: ReturnType<typeof setTimeout> | undefined
let root: Root | undefined
const render = (node: ReactNode) => {
    clearTimeout(slowBoot)
    root ??= createRoot(document.getElementById("root")!)
    root.render(
        <StrictMode>
            <ThemeProvider>{node}</ThemeProvider>
        </StrictMode>,
    )
    hideNativeSplash()
}

// A share that opened the picker waits until a site opens; the bridge then follows the pending path.
const stashColdShare = async () => {
    const [{ stashIncomingShare, SHARE_TARGET_PATH }, { pendingPath }] = await Promise.all([import("./shareIn"), import("./pending")])
    if (await stashIncomingShare()) await pendingPath.set(SHARE_TARGET_PATH)
}

// Same rule as the sdk: the site origin, with the port swapped for a bench's socket port.
// Only a plain-http site is a bench; hosted sites proxy socket.io on their own origin.
const socketUrl = (origin: string) => {
    const url = new URL(origin)
    if (import.meta.env.VITE_SOCKET_PORT && url.protocol === "http:") url.port = import.meta.env.VITE_SOCKET_PORT
    return url.origin
}

/** The default site with live tokens opens the app; anything else shows the picker. */
const boot = async () => {
    document.documentElement.classList.add("native")
    const url = await getDefaultSite()
    const site = url ? (await loadSites()).find((s) => s.url === url) : undefined
    if (site) slowBoot = setTimeout(() => render(<BootErrorScreen status="connecting" host={new URL(site.url).host} />), SLOW_BOOT_MS)
    const session = site ? await startSession(site) : null
    if (session === "rejected") return reloginAt(site!.url)
    if (!session) {
        await stashColdShare()
        return render(<SitePicker />)
    }
    // A dead session signs the same site in again rather than dropping to the picker.
    setSessionLostHandler(() => { reloginAt(session.site.url) })
    // Storage keys and URLs are scoped from here on; boot needs the token.
    setActiveSite(session.site.url, session.getToken)
    void import("./media").then((m) => m.setMediaSession(session.getToken()))
    const status = await loadBoot()
    if (status === "unauthorized") return reloginAt(session.site.url)
    if (status !== "ok") return render(<BootErrorScreen status={status} host={new URL(session.site.url).host} />)
    // Loaded only now: App's module graph reads boot and scoped storage keys at import.
    const { default: App } = await import("../App")
    const socket = new NativeSocket({ url: socketUrl(session.site.url), namespace: session.site.sitename, origin: session.site.url }, session.getToken)
    setTokenRefreshedHandler((token) => { socket.setToken(token); void import("./media").then((m) => m.setMediaSession(token)) })
    socket.start().catch(() => { })
    render(<App native={{ url: session.site.url, siteName: session.site.sitename, getToken: session.getToken, onRequestError, socket: socket as unknown as FrappeConfig["socket"] }} />)
    initNativePush()
    void refreshSite(session.site)
    // Media eviction follows the message cache: after each flush, throttled, and once at start.
    // Imported here, not at the top: the cache module opens the site-scoped database on load.
    void Promise.all([import("./media"), import("@stores/messages/messageCache")]).then(([m, cache]) => {
        cache.setCacheFlushListener(() => { void m.trimMediaCache() })
        void m.trimMediaCache()
    })
}

// A failure before anything rendered would leave the launch screen up with nothing to tap.
export const bootNative = () => boot().catch(() => { if (!root) render(<BootErrorScreen status="unavailable" host="" />) })
