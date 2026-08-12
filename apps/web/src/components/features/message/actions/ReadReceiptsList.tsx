import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"
import { Skeleton } from "@components/ui/skeleton"
import ErrorBanner from "@components/ui/error-banner"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { channelMembersStore } from "@stores/members/store"
import { useUser } from "@hooks/useUser"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import type { UserData } from "@db"

/** A channel member who has read the message. Just the id — the server keeps the
 *  `last_visit` watermark to itself, since it says when the member last caught up
 *  on the channel, not when they read this message. */
type MessageReader = {
    user_id: string
}

/** Row height = 20px avatar + the row's vertical padding (py-2 mobile, py-1.5 desktop).
 *  The scroller's height is computed from it, since neither host gives one. */
const ROW_HEIGHT = { mobile: 36, desktop: 32 }
const MAX_VISIBLE_ROWS = 8

/** The empty note is a line of text, not a person — it sits on the menu ITEM's height
 *  (py-1.5 + 14px line desktop, py-2 + 15px mobile), not a reader row's taller box. */
const EMPTY_HEIGHT = { mobile: 36, desktop: 28 }

/**
 * One reader row: avatar + name. The user is resolved reactively from the users
 * store (a profile/photo update reflects live), falling back to the raw id while
 * they aren't cached.
 */
const ReaderRow = ({ reader }: { reader: MessageReader }) => {
    const user = useUser(reader.user_id)
    const display = user ?? ({ name: reader.user_id, full_name: reader.user_id } as UserData)
    return (
        // Row geometry matches whichever host it lands in, so readers sit on the same
        // grid as the actions they replaced: desktop = the menu primitives'
        // BASE_ITEM_STYLES (gap-2 px-2 py-1.5); mobile = the sheet's action buttons
        // (gap-3 px-3, h-10 — py-2 around a 24px avatar).
        <div className="flex items-center gap-3 rounded px-3 py-2 md:gap-2 md:px-2 md:py-1.5">
            <UserAvatar user={display} size="xs" showStatusIndicator={false} />
            <span className="flex-1 truncate text-lg text-ink-gray-8 md:text-base">{display.full_name || display.name}</span>
        </div>
    )
}

/** Reader rows carry the panel's width (the submenu itself has none, so the empty state
 *  can shrink to its own line instead of sitting in a wide, mostly-blank card). Full
 *  width in the mobile sheet, which is already as wide as the screen. */
const PANEL_WIDTH = "w-full md:w-72"

/** Fallback when the member count isn't known (member list not loaded for that channel). */
const FALLBACK_SKELETON_ROWS = 3

/**
 * Placeholder rows on the same grid as the real ones. `rows` is guessed from the channel's
 * member count so the panel opens at (or near) its final height — see useSkeletonRows.
 */
const ReadersSkeleton = ({ rows }: { rows: number }) => (
    <div className={`${PANEL_WIDTH} px-3 md:px-2`}>
        {Array.from({ length: rows }).map((_row, index) => (
            <div key={index} className="flex items-center gap-3 py-2 md:gap-2 md:py-1.5">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 flex-1" />
            </div>
        ))}
    </div>
)

/**
 * How many placeholder rows to show while loading — the panel is content-sized, so a
 * skeleton that doesn't match the incoming list makes it jump as data lands.
 *
 * Readers can never exceed the channel's members minus the author, and the member list is
 * already in the store for the channel you're looking at (the header's avatar stack loads
 * it), so that upper bound is a free and usually exact guess. READ ONLY — no fetch is
 * triggered here; an unloaded channel just falls back to a small constant.
 */
const useSkeletonRows = (channelID: string): number => {
    const memberCount = useSyncExternalStore(
        useCallback((onChange) => channelMembersStore.subscribe(channelID, onChange), [channelID]),
        () => Object.keys(channelMembersStore.getEntry(channelID).members).length,
    )
    if (memberCount === 0) return FALLBACK_SKELETON_ROWS
    return Math.min(Math.max(memberCount - 1, 1), MAX_VISIBLE_ROWS)
}

/**
 * Who has read a message — the panel behind "View read receipts", rendered inside a
 * context/dropdown submenu on desktop and inside its own bottom sheet on mobile
 * (ReadReceiptsDialog). Both hosts mount it only once opened, so fetching on mount
 * IS fetching on open.
 *
 * Readers come from each channel member's `last_visit` watermark (the author is excluded
 * server-side), so this answers "who has seen it", not "whose device received it" — Raven
 * records no delivery state.
 */
export const ReadReceiptsList = ({
    message,
    sheet = false,
}: {
    message: Message
    /** Bottom-sheet mode (ReadReceiptsDialog): plain content-sized layout with a
     *  class-capped scroller, like ReactionsBody. The stated-height + transition
     *  wrapper below is for the desktop submenu only — inside a vaul sheet that
     *  extra fixed-height layer broke touch scrolling of the list. */
    sheet?: boolean
}) => {
    const isMobile = useIsMobile()
    const skeletonRows = useSkeletonRows(message.channel_id)
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: MessageReader[] }>(
        "raven.api.raven_message.get_message_readers",
        { message_id: message.name },
        ["message-readers", message.name],
    )

    // Refetch on every open. Both hosts mount this only once the panel opens, so mount IS
    // open — but SWR alone won't reissue: with the key already in cache it hands back the
    // previous readers and never revalidates (isValidating stays false), which would show
    // a list that's minutes or days old. mutate() makes that refetch explicit.
    //
    // Only when something IS cached, though: on a cold key SWR's own mount fetch already
    // covers it, and calling mutate() as well just doubles the request. Cached rows paint
    // immediately either way; the fresh list replaces them in place.
    // Keyed on the message, not `mutate` — one refetch per open is the whole point.
    useEffect(() => {
        if (data) mutate()
    }, [message.name])

    const readers = data?.message ?? []

    if (error) return <ErrorBanner error={error} />

    const rowHeight = isMobile ? ROW_HEIGHT.mobile : ROW_HEIGHT.desktop
    /* The list hugs its content up to MAX_VISIBLE_ROWS, then scrolls. The scroller
       needs a computed height because neither host gives it one: a submenu sizes to
       its content, and the drawer hugs its content too. */
    const visibleRows = Math.min(readers.length, MAX_VISIBLE_ROWS)

    // The panel's height is stated rather than left to the content, so the loading →
    // loaded change is an animated resize instead of a jump. The skeleton's guess is an
    // upper bound (members minus the author), which lands exactly right on a message most
    // of the channel has read and overshoots one only a few have — either way the panel
    // eases to the real height rather than snapping.
    const isEmpty = visibleRows === 0
    const emptyHeight = isMobile ? EMPTY_HEIGHT.mobile : EMPTY_HEIGHT.desktop
    const contentHeight = isLoading ? skeletonRows * rowHeight : isEmpty ? emptyHeight : visibleRows * rowHeight

    // Sheet mode: no stated heights, no height transition — the drawer hugs whatever
    // renders, and the list is a plain class-capped scroller. This mirrors the two
    // touch-scroll surfaces that are known to work inside vaul sheets (ReactionsBody's
    // max-h tab panels, ChannelMembersList) as closely as possible.
    if (sheet) {
        return isLoading ? (
            <ReadersSkeleton rows={skeletonRows} />
        ) : isEmpty ? (
            <p className="px-3 py-2 text-lg text-ink-gray-4">{_("No one has viewed this yet")}</p>
        ) : (
            <div className="max-h-80 overflow-y-auto">
                {readers.map((reader) => (
                    <ReaderRow key={reader.user_id} reader={reader} />
                ))}
            </div>
        )
    }

    return (
        <div
            className="overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none"
            style={{ height: contentHeight }}
        >
            {isLoading ? (
                <ReadersSkeleton rows={skeletonRows} />
            ) : isEmpty ? (
                // No PANEL_WIDTH, so the submenu shrinks to fit the sentence instead of
                // sitting in a wide blank card. h-full + centred rather than py-*: the
                // wrapper states the height (for the animation), so padding here would
                // leave dead space under the text.
                <p className="flex h-full items-center px-3 text-lg text-ink-gray-4 md:px-2 md:text-base">
                    {_("No one has viewed this yet")}
                </p>
            ) : (
                // A plain scroller, not a virtual list: rows are cheap (avatar + name),
                // and native overflow is what vaul and the dialog's scroll lock already
                // know how to let through on touch — the same pattern as ReactionsBody
                // and ChannelMembersList. overscroll-contain keeps a fling at the list's
                // end from scrolling whatever is behind the panel.
                <div className={`${PANEL_WIDTH} overflow-y-auto overscroll-contain`} style={{ height: visibleRows * rowHeight }}>
                    {readers.map((reader) => (
                        <ReaderRow key={reader.user_id} reader={reader} />
                    ))}
                </div>
            )}
        </div>
    )
}
