import { useAtomValue } from "jotai"
import { customEmojiSrcByNameAtom } from "@lib/emojiMart"

/**
 * Plain-text teaser with custom emojis shown as images. `emojiPositions` says which
 * `:name:` matches are real emojis; the rest were typed as text and stay text.
 */
export function TeaserText({ text, emojiPositions }: { text: string; emojiPositions?: number[] }) {
    // Only rows with emojis subscribe to the emoji list.
    return emojiPositions?.length ? <EmojiTeaserText text={text} emojiPositions={emojiPositions} /> : text
}

function EmojiTeaserText({ text, emojiPositions }: { text: string; emojiPositions: number[] }) {
    const srcByName = useAtomValue(customEmojiSrcByNameAtom)

    // Odd split indices are the shortcode matches, in order. Same pattern as the server
    // (raven_message.py SHORTCODE), so match N here is match N there.
    return text.split(/((?<![A-Za-z0-9_:]):[A-Za-z0-9_-]+:)/).map((part, i) => {
        const src = i % 2 && emojiPositions.includes((i - 1) / 2) ? srcByName.get(part.slice(1, -1)) : undefined
        return src ? (
            <img
                key={i}
                src={src}
                alt={part}
                loading="lazy"
                className="inline-block size-4 object-contain align-text-bottom"
            />
        ) : (
            part
        )
    })
}
