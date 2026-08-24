import { createContext, useContext } from "react"
import { useParams } from "react-router"

/**
 * The channel a chat view is currently showing. PROVIDED by the chat container
 * (ChatContentView), which always knows its channel — the URL only carries the
 * channel id on the channel/DM routes, so anything inside a chat rendered
 * elsewhere (the notification/search/saved panes) can't rely on route params.
 */
export const CurrentChannelContext = createContext<string | null>(null)

/**
 * The current channel id: the nearest chat container first, the URL param as a
 * fallback for code that runs outside a chat container (e.g. the command menu's
 * "search in this channel" scoping, which is a channel-route concept).
 */
export const useCurrentChannelID = () => {
    const fromContext = useContext(CurrentChannelContext)
    const params = useParams<{ id?: string }>()
    // Channel route: /:workspaceID/:id. DM route: /dm-channel/:id
    return fromContext ?? params.id ?? ""
}
