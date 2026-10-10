import {
    splitCustomEmojiShortcodes,
    useCustomEmojiShortcodes,
    type CustomEmojiShortcodes,
} from "@lib/customEmojiShortcodes"

/**
 * A `code` span. INVARIANT: every backtick in teaser text is a code marker —
 * producers (RavenMessage.parse_html_content, getDraftTeaser, getMessageTeaser)
 * swap literal backticks for the lookalike modifier grave (ˋ) before adding
 * markers, so the pairing here is exact. An unpaired marker (e.g. cut by the
 * teaser's length clamp) falls through as plain text.
 */
const CODE_SPAN = /(`[^`]+`)/

/** Plain-text teaser: code spans shown as code, known custom emoji `:name:`s as the emoji. */
export function TeaserText({ text }: { text: string }) {
    const shortcodes = useCustomEmojiShortcodes(text)
    if (!text.includes("`")) return withEmojis(text, shortcodes) ?? text
    return text.split(CODE_SPAN).map((chunk, i) =>
        i % 2 ? (
            <code key={i} className="rounded-sm bg-surface-gray-2 px-1 font-mono text-ink-gray-6">
                {chunk.slice(1, -1)}
            </code>
        ) : (
            <span key={i}>{withEmojis(chunk, shortcodes) ?? chunk}</span>
        ),
    )
}

const withEmojis = (text: string, shortcodes: CustomEmojiShortcodes | null) =>
    splitCustomEmojiShortcodes(text, shortcodes)?.map((part, i) =>
        typeof part === "string" ? (
            part
        ) : (
            <img
                key={i}
                src={part.src}
                alt={part.shortcode}
                loading="lazy"
                className="inline-block size-4 object-contain align-text-bottom"
            />
        ),
    )
