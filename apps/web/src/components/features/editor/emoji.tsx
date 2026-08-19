import { Extension } from "@tiptap/core"
import { Suggestion } from "@tiptap/suggestion"
import { Data, SearchIndex } from "emoji-mart"
import { getDefaultStore } from "jotai"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import { createSuggestionRender, findSuggestionMatchAfterNonWord } from "./createSuggestion"
import { emojiPluginKey } from "./suggestion"

const MAX_SUGGESTIONS = 8

/** The bits of an emoji-mart search result we use. Custom emojis carry `src` (no native). */
interface EmojiResult {
    id: string
    name: string
    skins: { native?: string; src?: string; shortcodes?: string }[]
}

const nativeOf = (emoji: EmojiResult): string => emoji.skins?.[0]?.native ?? ""
const srcOf = (emoji: EmojiResult): string => emoji.skins?.[0]?.src ?? ""

/**
 * emoji-mart's emoticon metadata is not a clean reverse map: of the 49 emoticon
 * strings in the Apple set (v14), exactly FIVE are claimed by several emojis,
 * and its index resolves them by accident of data order (last wins — which is
 * how ":)" landed on blush and "<3" on purple_heart). This table resolves ALL
 * five ambiguous strings deliberately, to the conventional pick; every other
 * emoticon has a single claimant and uses the dataset index untouched.
 */
const EMOTICON_CONFLICT_RESOLUTIONS: Record<string, string> = {
    ":)": "slightly_smiling_face", // vs smiley / smile / blush
    // Neither dataset claimant (unamused/disappointed) — 🙁 mirrors ":)" → 🙂.
    // ":-(" is single-claimant (disappointed) in the dataset but must agree
    // with ":(" the same way ":-)" agrees with ":)".
    ":(": "slightly_frowning_face",
    ":-(": "slightly_frowning_face",
    ":'(": "cry", // single tear — vs sob (😭 is a much stronger emotion)
    ":D": "smile", // vs grinning
    // Unreachable via the ":" suggestion trigger today — recorded so a future
    // inline-emoticon conversion (Slack-style ":) → 🙂 on space") doesn't ship
    // the dataset's accidental winner (purple_heart 💜).
    "<3": "heart", // vs yellow/green/blue/purple_heart
}

/**
 * Exact emoticon lookup. The FULL typed text is ":" + query (the ":" is eaten as
 * the suggestion trigger), so ":)" reaches the search as ")" — and substring
 * scoring then ranks OTHER emoticons above the intended one (")" hits "):" =
 * disappointed, not the ":)" smiley). emoji-mart's parsed data keeps an
 * emoticon → emoji-id index; an exact match on the full text wins outright.
 */
const emoticonMatch = (query: string): EmojiResult | null => {
    const data = Data as { emoticons?: Record<string, string>; emojis?: Record<string, EmojiResult> } | null
    if (!data?.emoticons || !data.emojis) return null
    // Emoticon keys are cased as authored (":D", ":P") — try the raw query and upper.
    for (const full of [`:${query}`, `:${query.toUpperCase()}`]) {
        const id = EMOTICON_CONFLICT_RESOLUTIONS[full] ?? data.emoticons[full]
        const emoji = id ? data.emojis[id] : undefined
        if (emoji) return emoji
    }
    return null
}

/**
 * How far a typo may be from a word and still match: how many single-letter
 * edits (add, drop, change, or swap two neighbours) turn one into the other.
 * Stops counting past `max` — rows whose best value already exceeds it can
 * never recover, so most non-matches exit after a couple of rows.
 */
const editDistance = (a: string, b: string, max: number): number => {
    if (a === b) return 0
    if (Math.abs(a.length - b.length) > max) return max + 1
    let prevPrev: number[] | null = null
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const row = [i]
        let rowMin = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
            // Two neighbouring letters swapped ("haert") count as ONE edit.
            if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d = Math.min(d, prevPrev[j - 2] + 1)
            }
            row.push(d)
            if (d < rowMin) rowMin = d
        }
        if (rowMin > max) return max + 1
        prevPrev = prev
        prev = row
    }
    return prev[b.length]
}

/** Every searchable word (id, name words, keywords) per emoji — built once,
 *  on the first zero-result search, from the same emoji-mart data. */
type FuzzyCandidate = { emoji: EmojiResult; words: string[] }
let fuzzyCandidates: FuzzyCandidate[] | null = null
const getFuzzyCandidates = (): FuzzyCandidate[] => {
    if (fuzzyCandidates) return fuzzyCandidates
    const data = Data as { emojis?: Record<string, EmojiResult & { name?: string; keywords?: string[] }> } | null
    fuzzyCandidates = Object.values(data?.emojis ?? {}).map((emoji) => ({
        emoji,
        words: [
            emoji.id,
            ...(emoji.name?.toLowerCase().split(/\s+/) ?? []),
            ...(emoji.keywords ?? []),
        ].filter(Boolean),
    }))
    return fuzzyCandidates
}

/** Custom Raven emojis as fuzzy candidates. Built fresh on each call, NOT
 *  cached like the built-in list: the set is small (dozens at most) and can
 *  change while the app runs (admins add/delete, realtime refetch). Read from
 *  the same atom every picker uses, so the two can't disagree. */
const getCustomCandidates = (): FuzzyCandidate[] => {
    const categories = getDefaultStore().get(customEmojiCategoriesAtom)
    return categories.flatMap((category) =>
        category.emojis.map((emoji) => ({
            emoji: emoji as EmojiResult,
            words: [emoji.id, ...(emoji.keywords ?? [])].map((word) => word.toLowerCase()).filter(Boolean),
        })),
    )
}

/**
 * Typo-tolerant fallback for when the normal search finds NOTHING ("haert",
 * "celabrate"). The index matches substrings, so one wrong letter kills it.
 * Here every emoji word is compared by edit distance instead: short queries
 * may be 1 edit off, longer ones 2. Comparing against the word's PREFIX (cut
 * to the query's length) also catches typos midway through a longer word
 * ("celab" → "celebrate"). Only runs on zero-result queries of 3+ letters,
 * so it can never push noise into a list that already has real matches.
 * Covers the built-in set AND the workspace's custom emojis.
 */
const fuzzySearchEmojis = (q: string): EmojiResult[] => {
    if (q.length < 3) return []
    const maxDist = q.length <= 5 ? 1 : 2
    // Keyed by emoji id: a custom emoji can appear in BOTH candidate lists
    // (registering customs puts them into emoji-mart's Data too, so the cached
    // built-in list may already hold them). Without the dedupe, a matching
    // custom emoji showed up twice. Ties keep the first hit; a better distance
    // replaces it.
    const bestById = new Map<string, { emoji: EmojiResult; dist: number }>()
    for (const candidate of [...getFuzzyCandidates(), ...getCustomCandidates()]) {
        let best = maxDist + 1
        for (const word of candidate.words) {
            const target = word.length > q.length ? word.slice(0, q.length) : word
            const dist = editDistance(q, target, maxDist)
            if (dist < best) best = dist
            if (best === 0) break
        }
        if (best <= maxDist) {
            const existing = bestById.get(candidate.emoji.id)
            if (!existing || best < existing.dist) {
                bestById.set(candidate.emoji.id, { emoji: candidate.emoji, dist: best })
            }
        }
    }
    return [...bestById.values()]
        .sort((a, b) => a.dist - b.dist || a.emoji.id.localeCompare(b.emoji.id))
        .map((s) => s.emoji)
}

interface EmojiSuggestionOptions {
    /** Letters typed after ":" before the popup shows. Mobile uses 2, so a
     *  ":)" or ":D" typed as plain text never summons UI. */
    minQueryLength: number
    /** Whether text smileys (":)", ":D") suggest their emoji. On mobile these
     *  are typed as literal text all the time, so the popup stays quiet. */
    emoticons: boolean
}

/**
 * Search emojis via emoji-mart's SearchIndex — the SAME source the app uses for
 * reactions (Apple set + Raven custom emojis, registered in useRegisterCustomEmojis).
 * Keeps anything renderable (a unicode char OR a custom image). Empty query → nothing
 * (":" alone shouldn't pop a list). Async; Tiptap's suggestion awaits it.
 * Misspelled queries that find nothing fall back to fuzzySearchEmojis above.
 */
const searchEmojis = async (query: string, options: EmojiSuggestionOptions): Promise<EmojiResult[]> => {
    const q = query.trim()
    if (!q || q.length < options.minQueryLength) return []
    const exact = options.emoticons ? emoticonMatch(q) : null
    // Symbol-only queries (")", "(", "-)", …) make fuzzy search pure noise
    // (")" scores "):", i.e. disappointed) — the exact emoticon is the ONLY
    // sensible answer, so show just it.
    if (exact && !/[a-z0-9]/i.test(q)) return [exact]

    const results = (await SearchIndex.search(q)) as EmojiResult[] | null
    let renderable = (results ?? []).filter((emoji) => nativeOf(emoji) || srcOf(emoji))
    if (renderable.length === 0) {
        renderable = fuzzySearchEmojis(q.toLowerCase()).filter((emoji) => nativeOf(emoji) || srcOf(emoji))
    }
    // A letter-bearing exact emoticon (":D", ":P") still ranks first, but keeps
    // the fuzzy results below — the user may be mid-shortcode (":p" → ":party").
    const ranked = exact ? [exact, ...renderable.filter((e) => e.id !== exact.id)] : renderable
    return ranked.slice(0, MAX_SUGGESTIONS)
}

/**
 * `:shortcode:` emoji autocomplete. Standard emojis insert as the native
 * unicode character (plain text → renders natively, no renderer change). Custom emojis
 * have no unicode, so they insert as a CustomEmoji node (a self-contained <img>).
 * Rows preview with <em-emoji> (standard) or the custom image, matching reactions.
 *
 * On both platforms, but tuned differently (useRavenEditor): mobile requires
 * 2 typed letters and skips the emoticon fast-path — phone keyboards have
 * their own emoji for the common case, and people type ":)" as plain text
 * there constantly. The `: `popup on mobile is mainly the inline path to
 * CUSTOM emojis, which no keyboard can type.
 */
export const EmojiSuggestion = Extension.create<EmojiSuggestionOptions>({
    name: "emojiSuggestion",

    addOptions() {
        return { minQueryLength: 1, emoticons: true }
    },

    addProseMirrorPlugins() {
        return [
            Suggestion<EmojiResult, EmojiResult>({
                editor: this.editor,
                char: ":",
                pluginKey: emojiPluginKey,
                // Fire after brackets/quotes/dashes too (not just space), but never
                // mid-word — keeps "https://" from opening the emoji popup.
                findSuggestionMatch: findSuggestionMatchAfterNonWord,
                items: ({ query }) => searchEmojis(query, this.options),
                command: ({ editor, range, props }) => {
                    const native = nativeOf(props)
                    const src = srcOf(props)
                    if (native) {
                        editor.chain().focus().insertContentAt(range, `${native} `).run()
                    } else if (src) {
                        editor
                            .chain()
                            .focus()
                            .insertContentAt(range, [
                                { type: "customEmoji", attrs: { src, alt: `:${props.id}:` } },
                                { type: "text", text: " " },
                            ])
                            .run()
                    }
                },
                render: createSuggestionRender<EmojiResult, EmojiResult>({
                    getKey: (emoji) => emoji.id,
                    toCommandArg: (emoji) => emoji,
                    renderItem: (emoji) =>
                        srcOf(emoji) ? (
                            <>
                                <img src={srcOf(emoji)} alt={emoji.id} loading="lazy" className="h-5 w-5 object-contain" />
                                <span className="truncate text-ink-gray-6">:{emoji.id}:</span>
                            </>
                        ) : (
                            <>
                                <em-emoji native={nativeOf(emoji)} set="native" size="1.2em" fallback={nativeOf(emoji)} />
                                <span className="truncate text-ink-gray-6">:{emoji.id}:</span>
                            </>
                        ),
                }),
            }),
        ]
    },
})
