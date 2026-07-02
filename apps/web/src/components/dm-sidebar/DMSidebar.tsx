import { memo, useEffect, useMemo, useRef } from "react"
import { NavLink, useMatch, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { useLiveQuery } from "dexie-react-hooks"
import { useCreateDM } from "@hooks/useCreateDM"
import { Skeleton } from "@components/ui/skeleton"
import { Badge } from "@components/ui/badge"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { db, type UserData } from "@db"
import { cn } from "@lib/utils"
import { formatRelativeDate } from "@lib/date"
import { getMessageTeaser } from "@utils/messageUtils"
import _ from "@lib/translate"
import type { DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { useChannelList } from "@stores/channels/useChannelList"
import { useChannelUnread } from "@stores/unread/useChannelUnread"
import { usePrefetchChannel, setChannelListScrolling } from "@stores/messages/usePrefetchChannel"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { MobileSearchButton } from "@components/features/header/QuickSearch/SearchButton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { UsersRoundIcon } from "lucide-react"

/** A DM channel joined to its resolved peer — what a sidebar row renders. */
type DMRowData = { dm: DMChannelListItem; peer: UserData }

type DMListContext = { showSuggestions: boolean; dmPeerIds: Set<string> }

/**
 * Defined at module level and passed via Virtuoso's `context` prop: an inline
 * `components={{ Footer: () => ... }}` creates a NEW component type every
 * render, so Virtuoso would unmount/remount the footer (re-running
 * ExtraUsersList's live query) on each sidebar render.
 */
const DMListFooter = ({ context }: { context?: DMListContext }) =>
    context?.showSuggestions ? <ExtraUsersList dmPeerIds={context.dmPeerIds} /> : null

const dmListComponents = { Footer: DMListFooter }

export function DMSidebar() {

    const { dmChannels, isLoading } = useChannelList()
    const usersById = useUsersById()

    // Reset scroll-suppression if we unmount mid-scroll (Virtuoso's isScrolling(false) wouldn't
    // fire), so prefetch isn't left globally suppressed.
    useEffect(() => () => setChannelListScrolling(false), [])

    /**
     * Join channels to peer users BEFORE the virtualizer. Virtuoso items must
     * never be zero-sized ("Zero-sized element" error), so a row component
     * can't resolve its user async and return null while loading — every item
     * handed to Virtuoso must be renderable. Filtering disabled/unresolvable
     * peers happens here for the same reason. One shared lookup Map also
     * replaces a per-row useUser subscription (see useMessageRowLookups).
     */
    const rows: DMRowData[] = useMemo(
        () =>
            dmChannels
                .flatMap((dm) => {
                    const peer = dm.peer_user_id ? usersById.get(dm.peer_user_id) : undefined
                    return peer && peer.enabled !== 0 ? [{ dm, peer }] : []
                })
                // Most recent conversation first; never-messaged DMs sink to the
                // bottom. last_message_timestamp is a fixed-width datetime, so a
                // string compare is chronological. Reorders live as the realtime
                // patch updates the timestamp (see useChannelListRealtime).
                .sort((a, b) => {
                    const ta = a.dm.last_message_timestamp ?? ""
                    const tb = b.dm.last_message_timestamp ?? ""
                    return ta < tb ? 1 : ta > tb ? -1 : 0
                }),
        [dmChannels, usersById]
    )

    const dmPeerIds = useMemo(
        () => new Set(dmChannels.map((d) => d.peer_user_id).filter(Boolean) as string[]),
        [dmChannels]
    )

    // The users table always contains at least the current user once Dexie
    // has hydrated — an empty map means we're still loading, not "no users"
    const usersReady = usersById.size > 0

    const navigate = useNavigate()
    const virtuosoRef = useRef<VirtuosoHandle>(null)
    // The sidebar mounts above the `:id` route, so useParams can't see the
    // channel; match the path instead (end: false keeps matching while a
    // thread drawer extends the URL)
    const routeMatch = useMatch({ path: "/dm-channel/:id", end: false })
    const currentChannelID = routeMatch?.params.id

    /** Cmd/Ctrl+Down = next channel, Cmd/Ctrl+Up = previous — clamped at the ends. */
    const goToAdjacentChannel = (direction: 1 | -1) => {
        if (rows.length === 0) return
        const currentIndex = rows.findIndex((row) => row.dm.name === currentChannelID)
        // Nothing open yet: Down enters the list from the top, Up from the bottom
        const nextIndex =
            currentIndex === -1
                ? direction === 1
                    ? 0
                    : rows.length - 1
                : Math.min(rows.length - 1, Math.max(0, currentIndex + direction))
        if (nextIndex === currentIndex) return
        navigate(`/dm-channel/${encodeURIComponent(rows[nextIndex].dm.name)}`)
        virtuosoRef.current?.scrollIntoView({ index: nextIndex })
    }

    // Works while composing too (form tags + Tiptap's contenteditable);
    // preventDefault stops the browser's own Cmd+Up/Down caret/scroll jumps
    const hotkeyOptions = { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true }
    useHotkeys("mod+down", () => goToAdjacentChannel(1), hotkeyOptions, [rows, currentChannelID])
    useHotkeys("mod+up", () => goToAdjacentChannel(-1), hotkeyOptions, [rows, currentChannelID])

    return (
        // Full-height column with its own header — mirrors ChannelSidebar, so
        // both sidebars carry their heading and the content column's AppHeader
        // is gone. Mobile sits on the page surface; desktop on the menu bar.
        <nav className="flex h-full w-full flex-col bg-surface-base md:bg-surface-sidebar">
            {/* Border on mobile only (full-page list needs the separator);
                none on desktop where the heading sits cleanly in the column */}
            <div className="flex h-11 md:h-auto shrink-0 items-center justify-between gap-1 border-b md:border-b-0 px-2 py-2">
                <span className="text-base font-medium text-ink-gray-8 px-1 py-1">{_("Direct Messages")}</span>
                <span className="md:hidden">
                    <MobileSearchButton />
                </span>
            </div>

            {/* No horizontal padding here: it would sit OUTSIDE Virtuoso's
                scroller (which clips overflow-x: hidden), so the active row's
                shadow/rounded edge would be cut. The inset lives on each row
                instead (px-2 on the NavLink/button), giving the shadow room
                inside the clip boundary. */}
            <div className="flex min-h-0 flex-1">
                {isLoading || !usersReady ? (
                    <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-2">
                        <DMSidebarSkeleton />
                    </div>
                ) : rows.length === 0 ? (
                    // No virtualizer for an empty list — just the empty state and,
                    // when the org has people to suggest, the start-a-DM rows
                    <Empty>
                        <EmptyMedia>
                            <UsersRoundIcon />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>{_("No conversations yet")}</EmptyTitle>
                            <EmptyDescription>{_("Search for a user and start a conversation.")}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <Virtuoso
                        ref={virtuosoRef}
                        className="flex-1 min-h-0"
                        style={{ height: "100%" }}
                        data={rows}
                        context={{ showSuggestions: rows.length < 5, dmPeerIds }}
                        isScrolling={setChannelListScrolling}
                        computeItemKey={(_index, row) => row.dm.name}
                        defaultItemHeight={64}
                        overscan={200}
                        components={dmListComponents}
                        itemContent={(_index, row) => <DMRow dmChannel={row.dm} peerUser={row.peer} />}
                    />
                )}
            </div>
        </nav>
    )
}


function DMSidebarSkeleton() {
    return (
        <>
            {Array.from({ length: 10 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-start gap-3 px-3 py-3 md:py-2"
                >
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex justify-between items-center gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-12 shrink-0" />
                        </div>
                        <Skeleton
                            className="h-3"
                            style={{ width: `${55 + (i % 3) * 15}%` }}
                        />
                    </div>
                </div>
            ))}
        </>
    )
}


interface DMRowProps {
    dmChannel: DMChannelListItem
    peerUser: UserData
}

// Memoized: the sidebar re-renders when ANY user changes (it needs the whole
// users map to filter disabled peers + sort), but the usersStore hands back
// reference-stable peer objects, so an unrelated user's change leaves this row's
// props identical and it bails. Only the changed user's row actually re-renders.
const DMRow = memo(function DMRow({ dmChannel, peerUser }: DMRowProps) {
    const { name: currentUser } = useUserCookieData()
    const { count: unread } = useChannelUnread(dmChannel.name)
    const prefetchHandlers = usePrefetchChannel(dmChannel.name, unread > 0)

    const isSelf = peerUser.name === currentUser
    const baseName = peerUser.full_name || peerUser.name
    const displayName = isSelf ? _("{0} (You)", [baseName]) : baseName
    const date = formatRelativeDate(dmChannel.last_message_timestamp)
    const lastMessage = getMessageTeaser(dmChannel.last_message_details, currentUser)

    return <NavLink {...prefetchHandlers} to={`/dm-channel/${encodeURIComponent(dmChannel.name)}`} className="block px-2 py-0.5">
        {({ isActive }) => (
            <DMRowShell
                user={peerUser}
                name={displayName}
                date={date}
                lastMessage={lastMessage}
                unread={unread}
                isActive={isActive}
            />
        )}
    </NavLink>
})


function ExtraUsersList({ dmPeerIds }: { dmPeerIds: Set<string> }) {
    const { name: currentUser } = useUserCookieData()

    const users =
        useLiveQuery(
            () =>
                db.users
                    .where("enabled")
                    .equals(1)
                    .and((u) => u.name !== currentUser)
                    .and((u) => u.type !== "Bot")
                    .and((u) => !dmPeerIds.has(u.name))
                    .limit(5)
                    .toArray(),
            [currentUser, dmPeerIds]
        ) ?? []

    if (users.length === 0) return null

    return (
        <>
            {users.map((user) => (
                <ExtraUserRow key={user.name} user={user} />
            ))}
        </>
    )
}


function ExtraUserRow({ user }: { user: UserData }) {
    const { createDM, loading } = useCreateDM()

    return (
        <button
            type="button"
            onClick={() => createDM(user.name)}
            disabled={loading}
            className="flex w-full px-2 disabled:pointer-events-none disabled:opacity-50"
        >
            <DMRowShell
                user={user}
                name={user.full_name || user.name}
                isActive={false}
            />
        </button>
    )
}


interface DMRowShellProps {
    user: UserData
    name: string
    date?: string
    lastMessage?: string
    unread?: number
    isActive: boolean
}

function DMRowShell({
    user,
    name,
    date = "",
    lastMessage = "",
    unread = 0,
    isActive,
}: DMRowShellProps) {


    return (
        <div
            className={cn(
                "flex w-full items-center gap-3 px-2 py-3 md:py-2 text-sm rounded transition-colors relative text-left",
                "select-none",
                "hover:bg-surface-gray-3 active:bg-surface-gray-3",
                isActive && "bg-surface-elevation-3 hover:bg-surface-elevation-3 active:bg-surface-elevation-3 shadow-sm"
            )}
        >
            <div className="flex items-center justify-center">
                <UserAvatar
                    user={user}
                    size="md"
                    showStatusIndicator
                    showBotIndicator
                />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2 mb-0.5">
                    <span
                        className={cn(
                            // leading-snug: the type scale's 1.15 line-height is too tight to
                            // contain descenders (g/y/p) once `truncate` clips overflow — Safari
                            // cuts them on some DPIs. A looser single-line height fixes it.
                            "truncate text-base md:text-sm leading-snug text-ink-gray-8",
                            unread > 0 ? "font-semibold" : "font-normal"
                        )}
                    >
                        {name}
                    </span>
                    {date && (
                        <span className="text-2xs text-ink-gray-4 shrink-0">
                            {date}
                        </span>
                    )}
                </div>
                {(lastMessage || unread > 0) && <div className="flex items-center gap-2">
                    {lastMessage && <div
                        className={cn(
                            // leading-snug: see note on the name above — line-clamp also clips
                            // descenders at the tight 1.15 line-height on Safari.
                            "line-clamp-1 text-sm md:text-xs leading-snug flex-1 min-w-0",
                            unread > 0
                                ? "font-medium text-ink-gray-8"
                                : "text-ink-gray-4"
                        )}
                    >
                        {lastMessage}
                    </div>}
                    {unread > 0 && (
                        <Badge size="sm" variant="subtle" theme="gray">
                            {unread > 9 ? "9+" : unread}
                        </Badge>
                    )}
                </div>}
            </div>
        </div>
    )
}
