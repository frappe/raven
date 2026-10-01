import type { ReactNode } from "react"
import { useAtomValue } from "jotai"
import { customEmojiSrcByNameAtom } from "@lib/emojiMart"
import type { LastMessageDetails } from "@utils/messageUtils"

type CustomEmojis = NonNullable<LastMessageDetails["custom_emojis"]>

/**
 * Plain-text teaser with its real custom emojis shown as images. Each one is the nth
 * occurrence of its shortcode (from the server); other `:name:` text stays text.
 */
export function TeaserText({ text, emojis }: { text: string; emojis?: CustomEmojis }) {
    // Only rows with emojis subscribe to the emoji list.
    return emojis?.length ? <EmojiTeaserText text={text} emojis={emojis} /> : text
}

function EmojiTeaserText({ text, emojis }: { text: string; emojis: CustomEmojis }) {
    const srcByName = useAtomValue(customEmojiSrcByNameAtom)

    const spans: { start: number; end: number; src: string; shortcode: string }[] = []
    for (const [shortcode, n] of emojis) {
        const start = nthOccurrence(text, shortcode, n)
        const src = srcByName.get(shortcode.slice(1, -1))
        if (start !== -1 && src) spans.push({ start, end: start + shortcode.length, src, shortcode })
    }
    spans.sort((a, b) => a.start - b.start)

    const parts: ReactNode[] = []
    let last = 0
    for (const { start, end, src, shortcode } of spans) {
        parts.push(text.slice(last, start))
        parts.push(
            <img
                key={start}
                src={src}
                alt={shortcode}
                loading="lazy"
                className="inline-block size-4 object-contain align-text-bottom"
            />
        )
        last = end
    }
    parts.push(text.slice(last))
    return parts
}

/** Index of the nth (0-based) occurrence of `sub`, scanning left to right without overlaps
 *  (the server's nth_occurrence scans the same way). -1 if there are fewer. */
const nthOccurrence = (text: string, sub: string, n: number): number => {
    let index = text.indexOf(sub)
    for (let i = 0; i < n && index !== -1; i++) index = text.indexOf(sub, index + sub.length)
    return index
}
