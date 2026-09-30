/**
 * Plain-text teaser with `:name:` shown as an image for each name in `emojis`
 * (name → src). Any other shortcode was typed as text and stays text.
 */
export function TeaserText({ text, emojis }: { text: string; emojis?: Record<string, string> }) {
    if (!emojis) return text

    // Split with a capture group: odd indices are the `:name:` shortcodes.
    return text.split(/(:[^\s:]+:)/).map((part, i) => {
        const name = part.slice(1, -1)
        return i % 2 && Object.prototype.hasOwnProperty.call(emojis, name) ? (
            <img key={i} src={emojis[name]} alt={part} loading="lazy" className="inline-block size-4 object-contain align-text-bottom" />
        ) : (
            part
        )
    })
}
