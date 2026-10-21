import { useAtom } from "jotai"
import { useFrappeGetCall } from "frappe-react-sdk"
import { QuickEmojisAtom, type QuickEmoji } from "./preferences"

/** A row of raven.api.reactions.most_used_reactions — the user's most-used
 *  reactions of the past 3 months, counted server-side across devices.
 *  Removed reactions don't count (un-reacting deletes the row). */
export type ReactionUsageRow = { reaction: string; is_custom: 0 | 1; reaction_escaped?: string | null; uses: number }

// Every surface fetches the same 6 rows under ONE SWR key and slices to what
// it shows (desktop 4, mobile 6) — instead of one server query per surface.
const FETCH_LIMIT = 6

/** Server rows → QuickEmoji list; empty unless a FULL set of `n` exists (the
 *  suggestion row applies as one unit). Custom emojis carry the image URL in
 *  `reaction` and their name in `reaction_escaped`. */
export const toSuggestedSet = (rows: ReactionUsageRow[] | undefined, n: number): QuickEmoji[] => {
    const mapped = (rows ?? []).slice(0, n).map((row): QuickEmoji =>
        row.is_custom
            ? { id: row.reaction_escaped || row.reaction, src: row.reaction }
            : { id: row.reaction, native: row.reaction },
    )
    return mapped.length === n ? mapped : []
}

/** Compare by native char (falling back to id): picker entries carry slug ids
 *  ("heart") while server rows carry the char, so ids alone can't match. */
const identity = (emoji: QuickEmoji) => emoji.native ?? emoji.id

/** Same emojis regardless of order — an equal suggestion has nothing to
 *  offer. A multiset compare, so duplicate entries also have to match. */
export const sameEmojiSet = (a: QuickEmoji[], b: QuickEmoji[]): boolean => {
    if (a.length !== b.length) return false
    const sortedA = a.map(identity).sort()
    const sortedB = b.map(identity).sort()
    return sortedA.every((value, index) => value === sortedB[index])
}

/**
 * Apply suggestions to the pinned slots: the first `n` slots become the
 * suggestions, later slots are kept. No emoji ends up pinned twice — a kept
 * slot that now duplicates a suggestion is refilled with one of the replaced
 * head emojis (dropped only when none is free), so the slot count holds.
 */
export const mergeSuggestions = (current: QuickEmoji[], suggestions: QuickEmoji[], n: number): QuickEmoji[] => {
    const seen = new Set(suggestions.map(identity))
    const refills = current.slice(0, n).filter((emoji) => !seen.has(identity(emoji)))
    const kept: QuickEmoji[] = []
    for (const slot of current.slice(n)) {
        const emoji = seen.has(identity(slot)) ? refills.shift() : slot
        if (!emoji || seen.has(identity(emoji))) continue
        seen.add(identity(emoji))
        kept.push(emoji)
    }
    return [...suggestions, ...kept]
}

/** The user's `n` most-used reactions, SWR-cached (no focus revalidation —
 *  this changes slowly). `enabled` gates the fetch: pass false while the
 *  hosting surface is closed, so a mounted-but-shut drawer costs nothing. */
export const useSuggestedReactions = (n: number, enabled = true): QuickEmoji[] => {
    const { data } = useFrappeGetCall<{ message: ReactionUsageRow[] }>(
        "raven.api.reactions.most_used_reactions",
        { limit: FETCH_LIMIT },
        enabled ? "most_used_reactions" : null,
        { revalidateOnFocus: false },
    )
    return toSuggestedSet(data?.message, n)
}

/**
 * Everything a preferences surface needs for its "Suggested" strip: the
 * suggestion set, whether to show it (hidden until a full set exists, or when
 * it already matches the first `n` pinned slots), and apply(). One hook for
 * desktop and mobile, so the two surfaces can't drift apart.
 */
export const useQuickEmojiSuggestions = (n: number, options?: { enabled?: boolean }) => {
    const [quickEmojis, setQuickEmojis] = useAtom(QuickEmojisAtom)
    const suggestions = useSuggestedReactions(n, options?.enabled ?? true)
    const showSuggestions = suggestions.length > 0 && !sameEmojiSet(suggestions, quickEmojis.slice(0, n))
    const apply = () => setQuickEmojis(mergeSuggestions(quickEmojis, suggestions, n))
    return { suggestions, showSuggestions, apply }
}
