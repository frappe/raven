import { createStore } from "jotai"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import { customEmojiShortcodesAtom } from "@lib/customEmojiShortcodes"

/** The emoji list a site with these custom emojis would have, for tests. */
export const shortcodesFor = (...names: string[]) => {
    const store = createStore()
    store.set(customEmojiCategoriesAtom, [
        {
            id: "raven",
            name: "Custom",
            emojis: names.map((name) => ({ id: name, name, keywords: [], skins: [{ src: `/files/${name}.png` }] })),
        },
    ])
    return store.get(customEmojiShortcodesAtom)
}
