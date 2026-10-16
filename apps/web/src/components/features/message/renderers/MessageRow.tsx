import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useUser } from "@hooks/useUser"
import { getDateObject } from "@lib/date"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { UserAvatar } from "../UserAvatar"
import { UserProfileHoverCard } from "./UserProfileHoverCard"
import { timeFormatAtom } from "@utils/preferences"
import { useAtomValue } from "jotai"

/**
 * Shared anatomy for everything rendered as a row in the chat stream
 * (single messages, batches). Keeps the shell, sender header, and time
 * formatting in ONE place so the two row types can't drift apart.
 */

/** Short (in-row), compact (gutter, no am/pm) and long (tooltip) display
 *  times for a message timestamp. */
export const useMessageTimes = (creation: string) => {

    const timeFormat = useAtomValue(timeFormatAtom)

    return useMemo(() => {
        try {
            const dateObject = getDateObject(creation)
            let format = "h:mm a"
            let compactFormat = "h:mm"
            if (timeFormat === "24-hour") {
                format = "HH:mm"
                compactFormat = "HH:mm"
            }

            return {
                shortTime: dateObject.format(format),
                compactTime: dateObject.format(compactFormat),
                longTime: dateObject.format(`Do MMMM YYYY, ${format}`),
            }
        } catch {
            return { shortTime: creation, compactTime: creation, longTime: creation }
        }
    }, [creation, timeFormat])
}

/** How a row sits in the stream. "simple" is the classic layout. In
 *  Left-Right mode, "own" content hugs the right edge and everyone else's
 *  ("left-right") hugs the left. The ROW is full width in every mode — the
 *  hover wash and highlights span the row, and the toolbar anchors to its
 *  corners. Only the CONTENT inside is aligned and width-capped. */
export type MessageRowAlignment = "simple" | "left-right" | "own"

/** The hoverable row shell every stream row shares. */
export const MessageRow = ({
    children,
    ref,
    className,
    alignment = "simple",
}: {
    children: React.ReactNode
    ref?: React.Ref<HTMLDivElement>
    className?: string
    alignment?: MessageRowAlignment
}) => (
    <div
        ref={ref}
        // Anchor for the floating hover toolbar (see MessageActionMenu) — the
        // hover hit can land on an inner element that also carries a
        // data-message-id (an image tile), so the row marks itself. The VALUE
        // tells the toolbar which corner to anchor to.
        data-message-row={alignment}
        className={cn(
            // overflow-hidden clips media to the rounded corners — but while this row
            // holds the inline editor, drop it so the editor's mention/emoji popup
            // (which rises above the box) isn't clipped by the row.
            "group/message-item w-full overflow-hidden has-[[data-raven-editor]]:overflow-visible relative hover:bg-surface-gray-1/50 py-2 rounded-md px-3.5 transition-all duration-200",
            className,
        )}
    >
        {children}
    </div>
)

// Width cap for a Left-Right message's content — the row stays full width,
// the content inside stops short of the other edge: 85% on mobile (the gap
// is what makes the side alignment readable on a narrow screen), 75% on
// desktop. Desktop also keeps a fixed 300px gutter free on the far side.
// That is where the hover toolbar sits (up to 276px wide, plus its inset),
// so in a narrow stream the bubble shrinks instead of the toolbar covering
// it. Mobile has no hover toolbar, so no gutter there. Dropped while the
// inline editor is open, so editing gets the whole row back.
const contentCapClass =
    "max-w-[85%] md:max-w-[min(75%,calc(100%-300px))] has-[[data-raven-editor]]:max-w-full"

// The text bubble, iMessage-like: tight padding, round corners, gray fill.
// The bubble has no hover style of its own — the row's wash is the hover
// feedback. ONLY text lives in bubbles: media, polls, cards, code blocks and
// GIFs render bare beside them (see MessageContent).
// The radius is CONSTANT for every bubble height — that's what iMessage does.
// 18px is half of a one-line bubble (24px line + 12px padding), so short
// bubbles come out as true pills and tall ones keep the same corners.
export const messageBubbleClass =
    "w-fit min-w-0 max-w-full rounded-[18px] bg-surface-gray-1 px-3 py-1.5 md:py-2"

// Alignment context for an own message's content column (thread pill footer,
// reactions). The editor escape keeps the inline edit box full width inside
// the w-fit chain.
const bubbleColumnClass = "flex w-fit max-w-full flex-col has-[[data-raven-editor]]:w-full"

/**
 * The sender layout inside a row: avatar + name + time header for the first
 * message of a group, the empty gutter for continuations. `children` render
 * in the (min-w-0) content column either way.
 *
 * Left-Right mode aligns the content: own messages sit right with no
 * avatar/name (just a time label), others keep the avatar and name · time
 * header. The content itself decides what gets a bubble (see MessageContent).
 */
export const MessageSenderLayout = ({
    owner,
    creation,
    isContinuation,
    isLeftRight = false,
    isOwn = false,
    reactions,
    footer,
    statusIcon,
    children,
}: {
    owner: string
    creation: string
    isContinuation: boolean
    /** Left-Right mode: others keep avatar + header above their content. */
    isLeftRight?: boolean
    /** Left-Right mode, current user's message: right-aligned, no avatar/name. */
    isOwn?: boolean
    /** Left-Right mode: the reactions row, rendered below the content. */
    reactions?: React.ReactNode
    /** Rendered under an OWN message's content, aligned to it (thread pill).
     *  Other/simple layouts render their footer at the row level instead. */
    footer?: React.ReactNode
    /** Shown to the LEFT of an own message's content — the failed-send icon. */
    statusIcon?: React.ReactNode
    children: React.ReactNode
}) => {
    const user = useUser(owner)
    const displayName = user?.full_name || user?.name || owner || _("User")
    const { shortTime, compactTime, longTime } = useMessageTimes(creation)

    if (isOwn) {
        return (
            <div className="flex flex-col items-end">
                {!isContinuation && (
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <span className="pb-1 pr-1 text-xs text-ink-gray-5">{shortTime}</span>
                        </TooltipTrigger>
                        <TooltipContent>{longTime}</TooltipContent>
                    </Tooltip>
                )}
                {/* Content hugs the right edge; the status icon (failed send)
                    sits on its left, centered like iMessage's error mark. */}
                <div className={cn("flex max-w-full items-center gap-1.5 has-[[data-raven-editor]]:w-full", contentCapClass)}>
                    {statusIcon}
                    <div className={cn(bubbleColumnClass, "items-end")}>
                        {children}
                        {reactions}
                        {footer}
                    </div>
                </div>
            </div>
        )
    }

    if (isContinuation) {
        return (
            <div className="flex items-start gap-3">
                {/* The time sits in the empty avatar gutter, and only while the row
                    is hovered. Very faint on purpose, so a burst of messages never
                    reads as a table. The tooltip carries the full date and am/pm. */}
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <span className="w-8 min-w-8 pt-0.5 text-right text-xs leading-5 tabular-nums text-ink-gray-4 opacity-0 transition-opacity duration-200 group-hover/message-item:opacity-100">
                            {compactTime}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>{longTime}</TooltipContent>
                </Tooltip>
                <div className={cn("flex-1 min-w-0", isLeftRight && contentCapClass)}>
                    {children}
                    {isLeftRight && reactions}
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            {/* Avatar triggers the same profile card as the name below. The
                trigger is the column div, not UserAvatar itself — asChild needs
                an element that forwards props to the DOM. */}
            <UserProfileHoverCard id={owner} fallbackLabel={displayName}>
                <div className="mt-0.5 cursor-pointer">
                    {user ? (
                        <UserAvatar user={user} size="md" />
                    ) : (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-surface-gray-2 flex items-center justify-center text-xs-medium text-ink-gray-4">
                            {displayName.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
            </UserProfileHoverCard>
            <div className={cn("flex-1 min-w-0", isLeftRight && contentCapClass)}>
                <div className="flex items-baseline gap-1">
                    {/* Same profile card as hovering a mention — a person's name
                        opens the same thing wherever it appears in the stream. */}
                    <UserProfileHoverCard id={owner} fallbackLabel={displayName}>
                        <span className="font-medium text-content text-ink-gray-6 dark:text-ink-gray-7 cursor-pointer">
                            {displayName}
                        </span>
                    </UserProfileHoverCard>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <span className="text-xs text-ink-gray-5">· {shortTime}</span>
                        </TooltipTrigger>
                        <TooltipContent>{longTime}</TooltipContent>
                    </Tooltip>
                </div>
                {/* Header-to-content gap lives HERE (not on content renderers)
                    so continuation rows — which skip this branch — stay tight.
                    pt-1 suits text (line-height adds visual leading); hard-edged
                    media boxes (albums, file grids) read tighter, so a media
                    root leading the content gets a nudge more. */}
                <div className="pt-1 [&_[data-media-root]:first-child]:mt-0.5">
                    {children}
                    {isLeftRight && reactions}
                </div>
            </div>
        </div>
    )
}
