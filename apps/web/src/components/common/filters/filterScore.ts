/**
 * Ranking for the filter comboboxes, replacing cmdk's default fuzzy score.
 *
 * The default scores a subsequence match — the query's letters appearing in order, anywhere
 * — highly enough that a long name can beat an exact one: "general" ranked
 * "long-ahh-channel-name-lol-edited-loooool" above the channel actually called "general",
 * and "yoda" didn't put Yoda in the top three. These tiers say plainly what beats what, and
 * subsequence survives only as a last resort so a typo still finds something.
 */

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")

/** Every character of `needle`, in order, somewhere in `haystack`. */
const isSubsequence = (haystack: string, needle: string): boolean => {
    let index = 0
    for (const character of haystack) {
        if (character === needle[index]) index++
        if (index === needle.length) return true
    }
    return false
}

/** How well one piece of text answers the search. `needle` must already be lowercased. */
const scoreText = (text: string, needle: string): number => {
    const haystack = text.toLowerCase()
    if (haystack === needle) return 1
    if (haystack.startsWith(needle)) return 0.9
    // A match that starts a word ("europe-general" for "general") reads as deliberate in a
    // way that one starting mid-word does not.
    if (new RegExp(`[^a-z0-9]${escapeForRegExp(needle)}`).test(haystack)) return 0.8
    if (haystack.includes(needle)) return 0.6
    return isSubsequence(haystack, needle) ? 0.1 : 0
}

/**
 * Ranks a row: `keywords` hold what a person reads and types (the channel or user's name),
 * `value` holds the doc name. The doc name is unique per doctype, which is what makes it the
 * right identity for cmdk — but it's also the part nobody searches for, so it only scores as
 * a fallback, below any name match.
 *
 * Returns 0 to drop the row. Shaped for cmdk's `filter` prop.
 */
export const scoreFilterRow = (value: string, search: string, keywords?: string[]): number => {
    const needle = search.toLowerCase().trim()
    if (!needle) return 1

    const labelScore = keywords?.reduce((best, keyword) => Math.max(best, scoreText(keyword, needle)), 0) ?? 0
    // Ids and emails stay searchable — "patiladitya781" should find that account — but never
    // outrank a row whose name matches.
    const idScore = value.toLowerCase().includes(needle) ? 0.4 : 0
    return Math.max(labelScore, idScore)
}
