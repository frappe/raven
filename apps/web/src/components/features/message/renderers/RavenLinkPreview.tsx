import { useCallback, useSyncExternalStore, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useFrappeGetDoc } from "frappe-react-sdk"
import { MessageSquareTextIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import { useChannelById } from "@stores/channels/useChannelList"
import { usersStore } from "@stores/usersStore"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { getMessageTeaser } from "@utils/messageUtils"
import type { Message } from "@raven/types/common/Message"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import _ from "@lib/translate"

/**
 * Rich previews for links INTO Raven itself — message permalinks, channels,
 * threads, DMs — pasted into chat. First provider in the LinkPreview chain.
 *
 * Permission model: message/thread cards fetch the Raven Message DOC, so
 * Frappe's doc-level permission query is the gate — a viewer without access to
 * the linked channel gets a 403 and the card simply never appears (the link
 * stays a plain anchor in the message body). Channel/DM cards resolve from the
 * client's own channel store, which only ever holds channels the viewer can
 * see — same effect, no request.
 *
 * Message/thread fetches are viewport-gated (useHasBeenInView) and reuse the
 * permalink page's SWR key, so opening the link after seeing the card is a
 * cache hit. Cards render nothing until data arrives (lazy-data pattern, same
 * as polls) — a no-access link never flashes a skeleton.
 */

type RavenLink =
    | { kind: "message"; messageID: string; to: string }
    | { kind: "thread"; threadID: string; to: string }
    | { kind: "channel"; workspaceID: string; channelID: string; to: string }
    | { kind: "dm"; channelID: string; to: string }

/** Top-level routes that are NOT workspace names — a two-segment path under one
 *  of these is never a channel link. */
const RESERVED_ROOTS = new Set([
    "dm-channel", "threads", "notifications", "search", "saved-messages",
    "profile", "share-target", "message", "settings", "login", "app",
])

export const matchRavenLink = (href: string): RavenLink | null => {
    let url: URL
    try {
        url = new URL(href)
    } catch {
        return null
    }
    if (url.origin !== window.location.origin) return null

    // Strip the app base (/raven) — copied links always carry it.
    const base = import.meta.env.VITE_BASE_NAME
    let path = url.pathname
    if (base) {
        if (path !== `/${base}` && !path.startsWith(`/${base}/`)) return null
        path = path.slice(base.length + 1) || "/"
    }
    // Keep query + hash on the navigation target (e.g. ?message_id= deep links).
    const to = path + url.search + url.hash

    const segments = path.split("/").filter(Boolean).map(decodeURIComponent)
    if (segments.length === 0) return null
    const [first, second, third, fourth] = segments

    if (first === "message" && second && segments.length === 2) return { kind: "message", messageID: second, to }
    // A thread id IS its root message's id, everywhere below.
    if (first === "threads" && second && segments.length === 2) return { kind: "thread", threadID: second, to }
    if (first === "dm-channel" && second) {
        if (third === "thread" && fourth) return { kind: "thread", threadID: fourth, to }
        if (segments.length === 2) return { kind: "dm", channelID: second, to }
        return null
    }
    if (RESERVED_ROOTS.has(first)) return null
    if (second && third === "thread" && fourth) return { kind: "thread", threadID: fourth, to }
    if (second && segments.length === 2) return { kind: "channel", workspaceID: first, channelID: second, to }
    return null
}

export const RavenLinkCard = ({ link }: { link: RavenLink }) => {
    switch (link.kind) {
        case "message":
            return <MessageLinkCard messageID={link.messageID} to={link.to} />
        case "thread":
            return <ThreadLinkCard threadID={link.threadID} to={link.to} />
        case "channel":
            return <ChannelLinkCard workspaceID={link.workspaceID} channelID={link.channelID} to={link.to} />
        case "dm":
            return <DMLinkCard channelID={link.channelID} to={link.to} />
    }
}

/* ------------------------------- Internals ------------------------------- */

/** Reactive single-user read (avatar + display name for card headers). */
const useUserLite = (userID?: string) =>
    useSyncExternalStore(
        useCallback(
            (listener: () => void) => (userID ? usersStore.subscribeUser(userID, listener) : () => { }),
            [userID],
        ),
        () => (userID ? usersStore.getUser(userID) : undefined),
    )

/** Same shell as the MeetingCard so internal cards sit in the family.
 *  `action` renders a button beside the content — a SIBLING of the content
 *  Link, never nested inside it (nested interactive elements are invalid);
 *  both navigate to the same place. */
const CardShell = ({ to, action, children }: { to: string; action?: string; children: ReactNode }) => (
    <div data-media-root="" className="w-full md:max-w-lg sm:max-w-md max-w-sm my-2">
        <div className="flex items-center gap-3 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-3 transition-colors hover:border-outline-gray-3 dark:bg-surface-elevation-2">
            <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                {children}
            </Link>
            {action && (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link to={to}>{action}</Link>
                </Button>
            )}
        </div>
    </div>
)

/** "in #channel · Workspace" — empty string when the channel isn't resolvable. */
const useChannelContext = (channel?: ChannelListItem): string => {
    const { workspaces } = useWorkspaces()
    if (!channel) return ""
    if (channel.is_direct_message === 1) return _("in a direct message")
    const workspace = workspaces.find((entry) => entry.name === channel.workspace)
    const name = `#${channel.channel_name}`
    return workspace ? `${name} · ${workspace.workspace_name}` : name
}

/**
 * A linked MESSAGE: sender avatar + name, where it lives, and a two-line
 * teaser. Fetch is viewport-gated; until (and unless) it succeeds, only an
 * invisible in-view sentinel renders — no card, no skeleton.
 */
const MessageLinkCard = ({ messageID, to, label }: { messageID: string; to: string; label?: string }) => {
    const { ref, hasBeenInView } = useHasBeenInView()
    // Same SWR key as MessagePermalink — clicking through is a cache hit.
    // No retry / no focus revalidation: an error here is almost always a 403
    // (viewer can't access the linked channel) — permanent for this session, so
    // re-firing the doomed request on every retry tick or tab focus is waste.
    // The card just stays absent. (Options are per-hook; MessagePermalink's use
    // of the same key keeps its own defaults.)
    const { data: message } = useFrappeGetDoc<Message>(
        "Raven Message",
        messageID,
        hasBeenInView ? `raven_message:${messageID}` : null,
        { shouldRetryOnError: false, revalidateOnFocus: false },
    )
    const channel = useChannelById(message?.channel_id ?? "")
    const sender = useUserLite(message?.owner)
    const context = useChannelContext(channel)

    if (!message) return <span ref={ref} aria-hidden="true" />

    const senderName = sender?.full_name ?? message.owner
    const teaser = getMessageTeaser(message)

    return (
        <CardShell to={to} action={label ? _("View thread") : _("View message")}>
            {sender ? (
                <UserAvatar user={sender} size="md" className="shrink-0" />
            ) : (
                <MessageSquareTextIcon className="size-8 shrink-0 text-ink-gray-6" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-sm text-ink-gray-5">
                    <span className="text-sm-medium leading-snug text-ink-gray-8">{label ?? senderName}</span>
                    {context && <span> · {context}</span>}
                </div>
                <div className="line-clamp-2 text-sm leading-snug text-ink-gray-7">
                    {label ? `${senderName}: ${teaser}` : teaser}
                </div>
            </div>
        </CardShell>
    )
}

/** A linked THREAD: the thread id is its root message's id — render the root
 *  through the message card with a "Thread" label. */
const ThreadLinkCard = ({ threadID, to }: { threadID: string; to: string }) => (
    <MessageLinkCard messageID={threadID} to={to} label={_("Thread")} />
)

/** A linked CHANNEL: resolves purely from the client store — unknown channel
 *  (no access / bad link) renders nothing. */
const ChannelLinkCard = ({ workspaceID, channelID, to }: { workspaceID: string; channelID: string; to: string }) => {
    const channel = useChannelById(channelID)
    const { workspaces } = useWorkspaces()
    if (!channel || channel.workspace !== workspaceID) return null
    const workspace = workspaces.find((entry) => entry.name === workspaceID)

    return (
        <CardShell to={to} action={_("Open")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-gray-3">
                <ChannelIcon type={channel.type} className="size-5 text-ink-gray-7" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-sm-medium leading-snug text-ink-gray-8">{channel.channel_name}</div>
                <div className="truncate text-sm leading-snug text-ink-gray-5">
                    {workspace ? _("Channel in {0}", [workspace.workspace_name]) : _("Channel")}
                </div>
            </div>
        </CardShell>
    )
}

/** A linked DM conversation: only resolvable when it's the viewer's own DM. */
const DMLinkCard = ({ channelID, to }: { channelID: string; to: string }) => {
    // DM rows in the store are DMChannelListItem (they carry the peer's id).
    const channel = useChannelById(channelID) as DMChannelListItem | undefined
    const peer = useUserLite(channel?.peer_user_id)
    if (!channel || channel.is_direct_message !== 1) return null

    return (
        <CardShell to={to} action={_("Open")}>
            {peer ? (
                <UserAvatar user={peer} size="md" className="shrink-0" />
            ) : (
                <MessageSquareTextIcon className="size-8 shrink-0 text-ink-gray-6" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-sm-medium leading-snug text-ink-gray-8">{peer?.full_name ?? _("Direct message")}</div>
                <div className="truncate text-sm text-ink-gray-5 leading-snug">{_("Direct message conversation")}</div>
            </div>
        </CardShell>
    )
}
