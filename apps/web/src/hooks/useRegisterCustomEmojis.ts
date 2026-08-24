import { useEffect } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import { useDebounceCallback } from "usehooks-ts"
import { useSetAtom } from "jotai"
import { RavenCustomEmoji } from "@raven/types/RavenMessaging/RavenCustomEmoji"
import { initEmojiMart, customEmojiCategoriesAtom } from "@lib/emojiMart"

/** Coalesce a burst of Raven Custom Emoji changes before refetching the list. */
const REFETCH_DEBOUNCE_MS = 1000

/**
 * Loads Raven's custom emojis and registers them with emoji-mart, so they show up in
 * the composer's `:` search (and any emoji-mart picker) alongside standard emojis —
 * one source of truth. Mounted once at the app shell.
 *
 * Fetches the full list (limit 0) since it seeds a global registry, not a paged table.
 */
export const useRegisterCustomEmojis = () => {
    const setCustomCategories = useSetAtom(customEmojiCategoriesAtom)
    const { data, mutate } = useFrappeGetDocList<RavenCustomEmoji>(
        "Raven Custom Emoji",
        { fields: ["name", "emoji_name", "image", "keywords"], limit: 0 },
        "all_custom_emojis",
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        }
    )

    useEffect(() => {
        if (!data) return
        const emojis = data
            .filter((emoji) => emoji.image && emoji.emoji_name)
            .map((emoji) => ({
                id: emoji.emoji_name,
                name: emoji.emoji_name,
                keywords: emoji.keywords ? emoji.keywords.split(/[\s,]+/).filter(Boolean) : [],
                skins: [{ src: emoji.image }],
            }))
        const categories = emojis.length ? [{ id: "raven", name: "Custom", emojis }] : []
        initEmojiMart(categories)
        setCustomCategories(categories)
    }, [data, setCustomCategories])

    // Debounced so a batch of emoji edits (e.g. bulk add) triggers one refetch.
    const debouncedRefetch = useDebounceCallback(mutate, REFETCH_DEBOUNCE_MS)
    useFrappeDocTypeEventListener("Raven Custom Emoji", () => debouncedRefetch())
}
