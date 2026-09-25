import { siteBaseName, siteOrigin } from "@lib/site"

// The site's own Raven links route in the app; everything else keeps Capacitor's default
// (a foreign origin opens in the system browser on both platforms).
export const inAppPath = (href: string, origin: string, baseName: string): string | null => {
    let url: URL
    try { url = new URL(href, origin) } catch { return null }
    if (url.origin !== origin) return null
    const prefix = `/${baseName}`
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null
    return (url.pathname.slice(prefix.length) || "/") + url.search + url.hash
}

export const subscribeLinkClicks = (onPath: (path: string) => void): (() => void) => {
    const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
        const anchor = (event.target as Element | null)?.closest?.("a[href]")
        if (!anchor) return
        const path = inAppPath(anchor.getAttribute("href") ?? "", siteOrigin(), siteBaseName())
        if (!path) return
        event.preventDefault()
        onPath(path)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
}
