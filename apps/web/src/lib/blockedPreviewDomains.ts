/**
 * Domain-wide preview blocks from Raven Settings, via boot (read lazily on
 * first use and cached: boot isn't populated when modules load in dev).
 * Suffix matching, like the provider registry: blocking frappe.io covers
 * its subdomains.
 */
let blockedDomains: string[] | null = null

export const isBlockedPreviewDomain = (href: string): boolean => {
    const domains =
        blockedDomains ??
        (((typeof window !== "undefined"
            ? window.frappe?.boot?.link_preview_blocked_domains
            : undefined) ?? []) as string[])
    blockedDomains = domains
    if (domains.length === 0) return false
    try {
        const host = new URL(href).hostname.toLowerCase()
        return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    } catch {
        return false
    }
}
