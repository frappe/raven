import { Extension } from "@tiptap/core"
import { Suggestion } from "@tiptap/suggestion"
import { Data, SearchIndex } from "emoji-mart"
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
 * Search emojis via emoji-mart's SearchIndex — the SAME source the app uses for
 * reactions (Apple set + Raven custom emojis, registered in useRegisterCustomEmojis).
 * Keeps anything renderable (a unicode char OR a custom image). Empty query → nothing
 * (":" alone shouldn't pop a list). Async; Tiptap's suggestion awaits it.
 */
const searchEmojis = async (query: string): Promise<EmojiResult[]> => {
    const q = query.trim()
    if (!q) return []
    const exact = emoticonMatch(q)
    // Symbol-only queries (")", "(", "-)", …) make fuzzy search pure noise
    // (")" scores "):", i.e. disappointed) — the exact emoticon is the ONLY
    // sensible answer, so show just it.
    if (exact && !/[a-z0-9]/i.test(q)) return [exact]

    const results = (await SearchIndex.search(q)) as EmojiResult[] | null
    const renderable = (results ?? []).filter((emoji) => nativeOf(emoji) || srcOf(emoji))
    // A letter-bearing exact emoticon (":D", ":P") still ranks first, but keeps
    // the fuzzy results below — the user may be mid-shortcode (":p" → ":party").
    const ranked = exact ? [exact, ...renderable.filter((e) => e.id !== exact.id)] : renderable
    return ranked.slice(0, MAX_SUGGESTIONS)
}

/**
 * Desktop-only `:shortcode:` emoji autocomplete. Standard emojis insert as the native
 * unicode character (plain text → renders natively, no renderer change). Custom emojis
 * have no unicode, so they insert as a CustomEmoji node (a self-contained <img>).
 * Rows preview with <em-emoji> (standard) or the custom image, matching reactions.
 *
 * Added to the editor only on desktop (useRavenEditor): mobile keyboards have their
 * own emoji and a popup on every ":" is noise.
 */
export const EmojiSuggestion = Extension.create({
    name: "emojiSuggestion",

    addProseMirrorPlugins() {
        return [
            Suggestion<EmojiResult, EmojiResult>({
                editor: this.editor,
                char: ":",
                pluginKey: emojiPluginKey,
                // Fire after brackets/quotes/dashes too (not just space), but never
                // mid-word — keeps "https://" from opening the emoji popup.
                findSuggestionMatch: findSuggestionMatchAfterNonWord,
                items: ({ query }) => searchEmojis(query),
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
