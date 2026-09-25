import { siteUrl } from "@lib/site"
import type { QuickEmoji } from "@utils/preferences"

/**
 * A QuickEmoji face: custom emojis are plain images; native ones render via
 * em-emoji from the Apple set (initialized in App.tsx) so reactions look the
 * same on every platform. Sized relative to the host's font size — put
 * text-2xl (or similar) on the wrapping button to scale it.
 */
export const EmojiFace = ({ emoji }: { emoji: QuickEmoji }) =>
    emoji.src ? (
        <img src={siteUrl(emoji.src)} alt={emoji.id} loading="lazy" className="h-4.5 w-4.5 object-contain" aria-hidden="true" />
    ) : (
        <span className="flex h-4.5 w-4.5 items-center justify-center" aria-hidden="true">
            <em-emoji native={emoji.native} set="native" size="1.1em" fallback={emoji.id} />
        </span>
    )
