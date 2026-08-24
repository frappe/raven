import { NavLink } from "react-router-dom"
import { useUser } from "@hooks/useUser"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useChannel } from "@hooks/useChannel"
import { UserProfileHoverCard } from "./UserProfileHoverCard"

/**
 * Interactive mention nodes. The backend stores mentions as plain
 * `<span data-type="userMention|channelMention" data-id="…">@Label</span>`;
 * RichTextRenderer swaps those spans for these components so we can:
 *   - resolve the CURRENT name (handles renamed/deleted users), not the label
 *     v2 baked into the HTML — falling back to that label while loading/unknown
 *   - highlight the viewer's OWN mention (data-self → amber, see rich-text.css)
 *   - show a profile hover card, and turn channels into real <NavLink>s
 *
 * Inline presentation lives in `.tiptap .mention` (the single source of truth);
 * these components emit markup + the data-self signal; the hover card itself
 * is the shared UserProfileHoverCard (also used on message sender names).
 */

export const UserMention = ({ id, fallback }: { id: string; fallback?: string }) => {
    const user = useUser(id)
    const { name: currentUser } = useUserCookieData()

    const label = user?.full_name || user?.name || fallback || id
    const isSelf = !!id && id === currentUser

    return (
        <UserProfileHoverCard id={id} fallbackLabel={label}>
            <span className="mention" data-type="userMention" data-id={id} data-self={isSelf ? "true" : undefined}>
                @{label}
            </span>
        </UserProfileHoverCard>
    )
}

export const ChannelMention = ({ id, fallback }: { id: string; fallback?: string }) => {
    const { channel } = useChannel(id)
    const label = channel?.channel_name || fallback || id

    // Unknown channel (not a member / archived / stale) → non-navigable span,
    // so we never render a link that 404s.
    if (!channel) {
        return (
            <span className="mention" data-type="channelMention" data-id={id}>
                #{label}
            </span>
        )
    }

    const to = channel.workspace ? `/${channel.workspace}/${id}` : `/${id}`
    return (
        <NavLink to={to} className="mention" data-type="channelMention" data-id={id}>
            #{label}
        </NavLink>
    )
}
