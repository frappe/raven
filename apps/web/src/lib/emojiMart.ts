import { init } from "emoji-mart"
import { atom } from "jotai"

/** An emoji-mart custom emoji category (what `init({ custom })` expects). */
export interface EmojiMartCustomCategory {
    id: string
    name: string
    emojis: { id: string; name: string; keywords: string[]; skins: { src: string }[] }[]
}

/**
 * The registered custom-emoji categories. Every `<Picker>` must pass these via its
 * `custom` prop — the Picker re-runs `init()` with its own props on mount, so without
 * it the picker shows no custom emojis (and clobbers the global registration the `:`
 * search uses). Set by useRegisterCustomEmojis once the list loads.
 */
export const customEmojiCategoriesAtom = atom<EmojiMartCustomCategory[]>([])

const loadAppleData = async () => {
    const response = await fetch("/assets/raven/emojis/emojis.json")
    return response.json()
}

/**
 * Initialise (or re-initialise) emoji-mart with the Apple set + optional custom emojis.
 *
 * Safe to call more than once: emoji-mart keeps the already-fetched Apple data (no
 * re-fetch), swaps in the latest `custom` category, and resets its search index — so
 * registering custom emojis once they load makes them show up in SearchIndex and any
 * picker. Called once at app start (no custom) and again from useRegisterCustomEmojis
 * once the custom list is fetched.
 */
export const initEmojiMart = (custom?: EmojiMartCustomCategory[]) =>
    init({ data: loadAppleData, set: "apple", custom })
