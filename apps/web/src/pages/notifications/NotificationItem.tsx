import { Fragment, memo, useRef } from "react"
import { CheckCheck, MessageSquare } from "lucide-react"
import { cn } from "@lib/utils"
import { hapticTick } from "@utils/haptics"
import { type NotificationObject } from "@stores/notifications/reducers"
import { LeavingRow } from "@components/common/LeavingRow"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { formatRelativeDate } from "@lib/date"
import { formatNameList } from "@lib/nameList"
import _ from "@lib/translate"
import RichTextRenderer from "@components/features/message/renderers/RichTextRenderer"
import type { UserData } from "@db"
import type { SelectedNotification } from "./NotificationChat"

const ChannelContext = ({
    notification,
}: {
    notification: Pick<NotificationObject, "is_thread" | "is_direct_message" | "channel_type" | "channel_name">
}) => {
    if (notification.is_thread) {
        return (
            <div className="flex items-center gap-1 text-xs text-ink-gray-4">
                <MessageSquare className="w-3 h-3" />
                <span>{_("Thread")}</span>
            </div>
        )
    }
    if (!notification.is_direct_message) {
        return (
            <div className="flex items-center gap-1 text-xs">
                <span className="text-ink-gray-4/80">{_("in")}</span>
                <ChannelIcon type={notification.channel_type} className="h-3 w-3 text-ink-gray-4" />
                <span className="font-medium text-ink-gray-8/70 group-hover:text-ink-gray-9 group-hover:underline transition-colors">
                    {notification.channel_name}
                </span>
            </div>
        )
    }
    return null
}

/** Swipe-right-to-mark-read (touch): the same gesture language and feel as
 * swipe-to-reply on message rows — same slop, flick, edge guard and haptic.
 * Only UNREAD rows arm the gesture; read rows have nothing to mark. */
const SWIPE_READ_EDGE_GUARD_PX = 32
const SWIPE_READ_COMMIT_PX = 56
const SWIPE_READ_MAX_PX = 88
const SWIPE_READ_SLOP_PX = 12
const SWIPE_READ_FLICK_VELOCITY = 0.5 // px/ms rightward
const SWIPE_READ_FLICK_MIN_PX = 20
/** Suppress the click synthesized from the drag — it would OPEN the notification. */
const SWIPE_READ_CLICK_GUARD_MS = 300

const rowShellClasses = (isRead: boolean | number, isActive: boolean) => cn(
    "group flex w-full items-start gap-3 px-2 py-3 md:py-2 text-sm rounded transition-colors relative text-left select-none",
    "hover:bg-surface-gray-3 active:bg-surface-gray-3",
    !isRead && !isActive && "bg-surface-gray-2/10",
    isActive && "bg-surface-elevation-3 hover:bg-surface-elevation-3 active:bg-surface-elevation-3 shadow-sm"
)

/** Avatar + name + relative date + channel context line, with the body content
 * below. Same shape as `MessageSenderLayout` — header on top, `pt-1` wrapper
 * keeps the gap to content consistent (only here; continuation-style rows
 * never apply to notification rows so there's no branch). */
const NotificationRowLayout = ({
    isRead,
    isActive,
    leaving = false,
    onClick,
    onMarkRead,
    swipeDismisses = false,
    avatar,
    name,
    relativeDate,
    channelContext,
    children,
}: {
    isRead: boolean | number
    isActive: boolean
    /** Read and moved-on-from: play the exit (fade + slide + collapse), the
     *  list drops the row when the animation ends. */
    leaving?: boolean
    onClick: () => void
    /** Swipe-right target (touch). Only armed while the row is unread. */
    onMarkRead?: () => void
    /** This view REMOVES read rows (unread-only): a committed swipe carries the
     *  row off-screen instead of snapping back — it's about to leave anyway.
     *  Views that keep read rows snap back and just restyle. */
    swipeDismisses?: boolean
    avatar: React.ReactNode
    name: string
    relativeDate: string
    channelContext?: React.ReactNode
    children: React.ReactNode
}) => {
    const rowRef = useRef<HTMLDivElement>(null)
    const glyphRef = useRef<HTMLDivElement>(null)
    const swipeRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        active: boolean
        velocity: number
        lastX: number
        lastTime: number
    } | null>(null)
    const suppressClickUntilRef = useRef(0)

    const canSwipeRead = !isRead && !!onMarkRead

    const onPointerDown = (event: React.PointerEvent) => {
        if (!canSwipeRead || event.pointerType !== "touch") return
        // The left screen edge belongs to the iOS back-swipe gesture.
        if (event.clientX <= SWIPE_READ_EDGE_GUARD_PX) return
        swipeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            velocity: 0,
            lastX: event.clientX,
            lastTime: event.timeStamp,
        }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const swipe = swipeRef.current
        if (!swipe || swipe.pointerId !== event.pointerId) return
        const dx = event.clientX - swipe.startX
        const dy = event.clientY - swipe.startY

        if (!swipe.active) {
            // Vertical-dominant or leftward travel: it's a scroll, stand down.
            if (Math.abs(dy) > SWIPE_READ_SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
                swipeRef.current = null
                return
            }
            if (dx < -SWIPE_READ_SLOP_PX) {
                swipeRef.current = null
                return
            }
            if (dx > SWIPE_READ_SLOP_PX && dx > Math.abs(dy)) {
                swipe.active = true
                ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
                if (rowRef.current) rowRef.current.style.transition = "none"
                if (glyphRef.current) glyphRef.current.style.transition = "none"
            }
        }

        if (swipe.active) {
            const dt = event.timeStamp - swipe.lastTime
            if (dt > 0) swipe.velocity = (event.clientX - swipe.lastX) / dt
            swipe.lastX = event.clientX
            swipe.lastTime = event.timeStamp

            // Dismissing views follow the finger all the way across (the row is
            // being thrown out — a wall mid-drag reads as resistance). Views
            // that snap back keep the short cap: it's a hint gesture there.
            const offset = swipeDismisses
                ? Math.max(dx, 0)
                : Math.min(Math.max(dx, 0), SWIPE_READ_MAX_PX)
            if (rowRef.current) rowRef.current.style.transform = `translateX(${offset}px)`
            if (glyphRef.current) glyphRef.current.style.opacity = String(Math.min(offset / SWIPE_READ_COMMIT_PX, 1))
        }
    }

    const onPointerEnd = (event: React.PointerEvent) => {
        const swipe = swipeRef.current
        if (!swipe || swipe.pointerId !== event.pointerId) return
        swipeRef.current = null
        if (!swipe.active) return

        suppressClickUntilRef.current = performance.now() + SWIPE_READ_CLICK_GUARD_MS

        // Commit on distance OR a rightward flick (same rule as swipe-to-reply).
        const dx = event.clientX - swipe.startX
        const commit =
            event.type !== "pointercancel" &&
            (dx >= SWIPE_READ_COMMIT_PX ||
                (swipe.velocity > SWIPE_READ_FLICK_VELOCITY && dx >= SWIPE_READ_FLICK_MIN_PX))

        const row = rowRef.current
        const glyph = glyphRef.current
        if (commit && swipeDismisses) {
            // The swipe finishes what it started: the row keeps travelling off
            // the right edge while the leave pipeline (expedited — no linger for
            // swipes) collapses the gap behind it. No snap-back, no cleanup:
            // the row is about to unmount.
            if (row) {
                row.style.transition = "transform 200ms ease-out, opacity 200ms ease-out"
                row.style.transform = `translateX(${(row.parentElement?.clientWidth ?? 400) + 32}px)`
                row.style.opacity = "0"
            }
        } else {
            // Snap the row back (animated), then drop the inline styles. Also
            // the commit path in views that KEEP read rows — the row stays,
            // restyled as read.
            if (row) {
                row.style.transition = "transform 150ms ease-out"
                row.style.transform = ""
                window.setTimeout(() => {
                    row.style.transition = ""
                }, 200)
            }
        }
        if (glyph) {
            glyph.style.transition = "opacity 150ms ease-out"
            glyph.style.opacity = "0"
        }

        if (commit) {
            hapticTick()
            onMarkRead?.()
        }
    }

    const onClickCapture = (event: React.MouseEvent) => {
        if (performance.now() > suppressClickUntilRef.current) return
        suppressClickUntilRef.current = 0
        event.preventDefault()
        event.stopPropagation()
    }

    // The row is a DIV with button semantics, not a real <button>: the body
    // renders rich message content that can contain interactive elements (a
    // code block's copy button, links), and a button inside a button is
    // invalid HTML. Clicks on those inner controls must also not open the
    // notification — they did their own job.
    const onRowClick = (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest("button, a")) return
        onClick()
    }

    const onRowKeyDown = (event: React.KeyboardEvent) => {
        if (event.target !== event.currentTarget) return
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onClick()
        }
    }

    return (
        <LeavingRow leaving={leaving}>
        <div
            role="button"
            tabIndex={0}
            onClick={onRowClick}
            onKeyDown={onRowKeyDown}
            onClickCapture={onClickCapture}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            // pan-y: the browser keeps vertical scrolling, horizontal drags stay
            // ours — without it the scroller claims the touch mid-swipe
            // (pointercancel) and the row snaps back for no visible reason.
            className={cn("relative block w-full cursor-pointer px-2 py-0.5", canSwipeRead && "[touch-action:pan-y]")}
        >
            {/* Mark-read glyph behind the row's left edge — fades in as the row
                slides right, full strength at the commit distance. */}
            {canSwipeRead && (
                <div
                    ref={glyphRef}
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 z-0 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface-gray-3 text-ink-gray-7 opacity-0"
                >
                    <CheckCheck className="size-4" />
                </div>
            )}
            <div ref={rowRef} className={rowShellClasses(isRead, isActive)}>
                {avatar}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={cn("text-sm", !isRead ? "font-semibold" : "font-medium")}>
                            {name}
                        </span>
                        <span className="text-xs font-regular text-ink-gray-4 shrink-0">
                            {relativeDate}
                        </span>
                        {channelContext}
                    </div>
                    <div className="pt-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
        </LeavingRow>
    )
}

const UnreadDot = () => (
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-surface-blue-5" />
)

/** Body preview for a notification. Prefers the rich `text` (Tiptap HTML); when
 * empty (File/Poll/Image messages, or text-less custom types) falls back to the
 * plain-text `content` field maintained server-side. */
const NotificationBody = ({ notification }: { notification: NotificationObject }) => {
    if (notification.text) return <RichTextRenderer html={notification.text} />
    if (notification.content) return <span>{notification.content}</span>
    return <span>{_("Message")}</span>
}

/** Single-string template with a `{0}` placeholder for the emoji slot — keeps
 * the sentence atomic for translators (word order varies across languages),
 * then splices the emoji JSX (mix of <img> for custom + text for unicode) at
 * render time. */
const renderReactedSentence = (reactions: { reaction: string; is_custom: 0 | 1 }[]) => {
    const hasReactions = reactions.length > 0
    const template = hasReactions
        ? _("Reacted {0} to your message.")
        : _("Reacted to your message.")
    if (!hasReactions) return template
    const [before, after = ""] = template.split("{0}")
    return (
        <>
            {before}
            <span className="inline-flex items-center gap-0.5 align-middle">
                {reactions.map((r, i) => (
                    <Fragment key={i}>
                        {i > 0 && <span>,&nbsp;</span>}
                        {r.is_custom ? (
                            <img
                                src={r.reaction}
                                alt=""
                                loading="lazy"
                                className="h-4 w-4 inline-block"
                            />
                        ) : (
                            <span className="text-base leading-none">{r.reaction}</span>
                        )}
                    </Fragment>
                ))}
            </span>
            {after}
        </>
    )
}

export const MentionItem = memo(({
    notification,
    sender,
    isActive,
    leaving,
    onSelect,
    onMarkRead,
    swipeDismisses,
}: {
    notification: NotificationObject
    sender?: UserData
    isActive: boolean
    /** Mid-exit from the unread view — renders collapsing (see NotificationRowLayout). */
    leaving?: boolean
    onSelect: (selection: SelectedNotification) => void
    /** Swipe-right on an unread row marks it read without opening it. */
    onMarkRead?: (messageID: string) => void
    /** See NotificationRowLayout — unread-only views dismiss on swipe. */
    swipeDismisses?: boolean
}) => {
    const handleClick = () => {
        onSelect({
            channelID: notification.channel_id,
            messageID: notification.message_id,
            isThread: !!notification.is_thread,
            isDirectMessage: !!notification.is_direct_message,
            peer: notification.is_direct_message ? sender : undefined,
        })
    }
    return (
        <NotificationRowLayout
            isRead={notification.is_read}
            isActive={isActive}
            leaving={leaving}
            onClick={handleClick}
            onMarkRead={onMarkRead ? () => onMarkRead(notification.message_id) : undefined}
            swipeDismisses={swipeDismisses}
            avatar={
                <div className="relative shrink-0">
                    {sender && <UserAvatar user={sender} size="md" />}
                    {!notification.is_read && <UnreadDot />}
                </div>
            }
            name={sender?.full_name ?? notification.owner}
            relativeDate={formatRelativeDate(notification.creation)}
            channelContext={<ChannelContext notification={notification} />}
        >
            <div className="line-clamp-2">
                <NotificationBody notification={notification} />
            </div>
        </NotificationRowLayout>
    )
})

export const ReactionItem = memo(({
    notification,
    usersById,
    isActive,
    leaving,
    onSelect,
    onMarkRead,
    swipeDismisses,
}: {
    notification: NotificationObject
    usersById: Map<string, UserData>
    isActive: boolean
    /** Mid-exit from the unread view — renders collapsing (see NotificationRowLayout). */
    leaving?: boolean
    onSelect: (selection: SelectedNotification) => void
    /** Swipe-right on an unread row marks it read without opening it. */
    onMarkRead?: (messageID: string) => void
    /** See NotificationRowLayout — unread-only views dismiss on swipe. */
    swipeDismisses?: boolean
}) => {
    const reactors = notification.reactors ?? []
    const total = reactors.length
    // formatNameList uses 3 names when total<=3, else only 2.
    const namesNeeded = total <= 3 ? total : 2
    // O(1) Map lookups against the shared users snapshot — avoids a per-row
    // Dexie `useLiveQuery` subscription (would be N observers for N rows).
    const reactorsData = reactors.slice(0, namesNeeded).map((id) => usersById.get(id))

    const names = reactorsData.map((u, i) => u?.full_name ?? reactors[i])
    const reactorText = formatNameList(names, total)
    const displayReactions = (notification.reactions ?? []).slice(0, 5)

    const handleClick = () => {
        onSelect({
            channelID: notification.channel_id,
            messageID: notification.message_id,
            isDirectMessage: !!notification.is_direct_message,
            peer: notification.is_direct_message ? reactorsData[0] : undefined,
            isThread: !!notification.is_thread,
        })
    }

    return (
        <NotificationRowLayout
            isRead={notification.is_read}
            isActive={isActive}
            leaving={leaving}
            onClick={handleClick}
            onMarkRead={onMarkRead ? () => onMarkRead(notification.message_id) : undefined}
            swipeDismisses={swipeDismisses}
            avatar={
                <div className="relative shrink-0 w-8 h-8">
                    {reactorsData[0] && (
                        <div className={cn("absolute", total > 1 ? "top-0 left-0 w-6 h-6" : "inset-0")}>
                            <UserAvatar user={reactorsData[0]} size={total > 1 ? "xs" : "md"} />
                        </div>
                    )}
                    {reactorsData[1] && total > 1 && (
                        <div className="absolute bottom-0 right-0 w-5 h-5 ring-1 ring-surface-gray-1 rounded-full overflow-hidden">
                            <UserAvatar user={reactorsData[1]} size="xs" />
                        </div>
                    )}
                    {!notification.is_read && <UnreadDot />}
                </div>
            }
            name={reactorText}
            relativeDate={formatRelativeDate(notification.creation)}
            channelContext={<ChannelContext notification={notification} />}
        >
            <p className="flex items-center gap-1.5 text-sm text-ink-gray-8">
                {renderReactedSentence(displayReactions)}
            </p>
            <div className="mt-2 border-l-2 border-outline-gray-2 pl-2 text-xs text-ink-gray-4 line-clamp-2 [&_p]:my-0">
                <NotificationBody notification={notification} />
            </div>
        </NotificationRowLayout>
    )
})
