import { atom, useAtomValue } from "jotai"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"

/**
 * A known custom emoji's `:name:` is that emoji everywhere: message bodies, DM teasers
 * and the composer all show it as the image, whether it was typed, pasted or sent as text.
 */
export type CustomEmojiShortcodes = { pattern: RegExp; srcByName: Map<string, string> }

export type ShortcodePart = string | { shortcode: string; src: string }

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Null until any custom emoji exists. */
export const customEmojiShortcodesAtom = atom<CustomEmojiShortcodes | null>((get) => {
    const srcByName = new Map<string, string>()
    for (const category of get(customEmojiCategoriesAtom)) {
        for (const emoji of category.emojis) srcByName.set(emoji.id, emoji.skins[0].src)
    }
    if (!srcByName.size) return null
    // Longest first, so a name that contains another wins. Not right after a word
    // char, so times and URLs ("10:30:", "a:b:") stay text — those always have a
    // word char before the colon. A colon before is allowed: it's the closing
    // colon of an adjacent shortcode (":party::party:").
    const names = [...srcByName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp)
    return { pattern: new RegExp(`(?<![A-Za-z0-9_]):(${names.join("|")}):`, "g"), srcByName }
})

const noShortcodesAtom = atom<CustomEmojiShortcodes | null>(null)

/** A shortcode needs two colons; anything without them can skip the emoji list. */
const mayHoldShortcode = (text: string) => {
    const first = text.indexOf(":")
    return first !== -1 && text.indexOf(":", first + 1) !== -1
}

/** The emoji list for `text`. Only text that could hold a shortcode subscribes to it. */
export const useCustomEmojiShortcodes = (text: string) =>
    useAtomValue(mayHoldShortcode(text) ? customEmojiShortcodesAtom : noShortcodesAtom)

/** `text` split around its known shortcodes, or null when it holds none. */
export const splitCustomEmojiShortcodes = (
    text: string,
    shortcodes: CustomEmojiShortcodes | null,
): ShortcodePart[] | null => {
    if (!shortcodes || !mayHoldShortcode(text)) return null
    const parts: ShortcodePart[] = []
    let last = 0
    for (const match of text.matchAll(shortcodes.pattern)) {
        if (match.index > last) parts.push(text.slice(last, match.index))
        parts.push({ shortcode: match[0], src: shortcodes.srcByName.get(match[1]) as string })
        last = match.index + match[0].length
    }
    if (parts.length === 0) return null
    if (last < text.length) parts.push(text.slice(last))
    return parts
}
