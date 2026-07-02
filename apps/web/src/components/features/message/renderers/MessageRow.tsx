import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useUser } from "@hooks/useUser"
import { getDateObject } from "@lib/date"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { UserAvatar } from "../UserAvatar"
import { timeFormatAtom } from "@utils/preferences"
import { useAtomValue } from "jotai"

/**
 * Shared anatomy for everything rendered as a row in the chat stream
 * (single messages, batches). Keeps the shell, sender header, and time
 * formatting in ONE place so the two row types can't drift apart.
 */

/** Short (in-row) and long (tooltip) display times for a message timestamp. */
export const useMessageTimes = (creation: string) => {

    const timeFormat = useAtomValue(timeFormatAtom)

    return useMemo(() => {
        try {
            const dateObject = getDateObject(creation)
            let format = "h:mm a"
            if (timeFormat === "24-hour") {
                format = "HH:mm"
            }

            return {
                shortTime: dateObject.format(format),
                longTime: dateObject.format(`Do MMMM YYYY, ${format}`),
            }
        } catch {
            return { shortTime: creation, longTime: creation }
        }
    }, [creation, timeFormat])
}

/** The hoverable row shell every stream row shares. */
export const MessageRow = ({
    children,
    ref,
    className,
}: {
    children: React.ReactNode
    ref?: React.Ref<HTMLDivElement>
    className?: string
}) => (
    <div
        ref={ref}
        className={cn(
            // overflow-hidden clips media to the rounded corners — but while this row
            // holds the inline editor, drop it so the editor's mention/emoji popup
            // (which rises above the box) isn't clipped by the row.
            "group/message-item w-full overflow-hidden has-[[data-raven-editor]]:overflow-visible relative hover:bg-surface-gray-1 py-2 rounded-md px-3.5 transition-all duration-200",
            className,
        )}
    >
        {children}
    </div>
)

/**
 * The sender layout inside a row: avatar + name + time header for the first
 * message of a group, the empty gutter for continuations. `children` render
 * in the (min-w-0) content column either way.
 */
export const MessageSenderLayout = ({
    owner,
    creation,
    isContinuation,
    children,
}: {
    owner: string
    creation: string
    isContinuation: boolean
    children: React.ReactNode
}) => {
    const user = useUser(owner)
    const displayName = user?.full_name || user?.name || owner || _("User")
    const { shortTime, longTime } = useMessageTimes(creation)

    if (isContinuation) {
        return (
            <div className="flex items-start gap-3">
                <div className="w-8 min-w-8" />
                <div className="flex-1 min-w-0">{children}</div>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            {user ? (
                <UserAvatar user={user} size="md" />
            ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-surface-gray-2 flex items-center justify-center text-xs font-medium text-ink-gray-4">
                    {displayName.slice(0, 2).toUpperCase()}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1">
                    <span className="font-medium text-sm text-ink-gray-6">{displayName}</span>
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
                </div>
            </div>
        </div>
    )
}
