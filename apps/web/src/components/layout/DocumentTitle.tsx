import { useMatch } from "react-router-dom"
import { useChannelList } from "@stores/channels/useChannelList"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { useTotalUnread } from "@stores/unread/useChannelUnread"
import { useUnreadThreadsCount } from "@stores/threads/useUnreadThreads"
import _ from "@lib/translate"

/**
 * Sets the browser tab title to "(unread) <current page> - <app name>".
 *
 * React 19 hoists a rendered <title> into <head>, so this is just a reactive
 * component — no document.title effect. It lives above the router, so it derives
 * the current channel/page from the path itself (rather than each page setting
 * its own title). Static pages are matched BEFORE the /:workspaceID/:id pattern,
 * since "/notifications/:id" and "/dm-channel/:id" would otherwise match it.
 */
const DocumentTitle = () => {
    // Total unread conversations = channels/DMs + threads (both conversation counts, so they
    // add). Threads aren't in the channel unread store — they ride their own store.
    const unread = useTotalUnread() + useUnreadThreadsCount()
    const label = useCurrentPageLabel()

    const appName = (window as { app_name?: string }).app_name || "Raven"
    const prefix = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ` : ""
    const title = label ? `${prefix}${label} | ${appName}` : `${prefix}| ${appName}`

    return <title>{title}</title>
}

/** Human label for the open page — the channel/DM name, or a static page name. */
const useCurrentPageLabel = (): string | null => {
    const { channels, dmChannels } = useChannelList()
    const usersById = useUsersById()

    // end: false so a channel stays matched while a thread drawer extends the URL
    const channelMatch = useMatch({ path: "/:workspaceID/:id", end: false })
    const dmMatch = useMatch({ path: "/dm-channel/:id", end: false })
    const dmIndex = useMatch({ path: "/dm-channel", end: true })
    const notifications = useMatch({ path: "/notifications", end: false })
    const threads = useMatch({ path: "/threads", end: false })
    const saved = useMatch({ path: "/saved-messages", end: false })
    const search = useMatch({ path: "/search", end: false })

    // Static pages first — their leading segment would otherwise read as a workspace
    if (notifications) return _("Notifications")
    if (threads) return _("Threads")
    if (saved) return _("Saved Messages")
    if (search) return _("Search")

    if (dmMatch) {
        const dm = dmChannels.find((channel) => channel.name === dmMatch.params.id)
        const peer = dm?.peer_user_id ? usersById.get(dm.peer_user_id) : undefined
        return peer?.first_name || peer?.full_name || peer?.name || _("Direct Message")
    }
    if (dmIndex) return _("Direct Messages")

    if (channelMatch?.params.id) {
        const channel = channels.find((c) => c.name === channelMatch.params.id)
        return channel?.channel_name ?? null
    }

    return null
}

export default DocumentTitle
