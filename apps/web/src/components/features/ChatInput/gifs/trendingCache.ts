import type { KlipyPage } from "@lib/klipy"

/** Trending shifts slowly; this long it's reused rather than fetched again. */
const TTL_MS = 5 * 60_000

/** The first trending page, in memory only, shared by every picker this session. */
let cached: { page: KlipyPage; at: number } | undefined

export const rememberTrending = (page: KlipyPage) => {
    // An empty answer would show "No GIFs found" in every picker until it expired.
    if (page.items.length) cached = { page, at: Date.now() }
}

export const recentTrending = (): KlipyPage | undefined =>
    cached && Date.now() - cached.at < TTL_MS ? cached.page : undefined
