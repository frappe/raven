import { ArrowDownToLineIcon, Share2, X } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { UserAvatar } from "../UserAvatar"
import { useMessageTimes } from "./MessageRow"
import { formatRelativeDate } from "@lib/date"
import _ from "@lib/translate"
import type { UserData } from "@db"

/**
 * Shared header for the media preview modals (images, files) — sender
 * identity on the left, file identity in the middle, actions on the right.
 * `children` render between the file name and the action buttons (e.g. the
 * image slideshow's "2 of 5" counter).
 */
export const MediaPreviewHeader = ({
    user,
    creation,
    fileName,
    fileSize,
    badge,
    children,
    onDownload,
    onShare,
    onClose,
}: {
    user?: UserData
    /** Raw message timestamp — the header owns its display formatting. */
    creation?: string
    fileName: string
    fileSize?: string
    /** Optional pill beside the file name (e.g. a "Preview" tag in composer mode). */
    badge?: React.ReactNode
    children?: React.ReactNode
    /** Omit to hide the action — e.g. preview mode has no download/share. */
    onDownload?: () => void
    onShare?: () => void
    onClose: () => void
}) => {
    const { longTime } = useMessageTimes(creation ?? "")
    // "9:34 AM" / "Yesterday" / "Jun 2" — a bare clock time is meaningless on
    // older messages; the full date+time lives in the tooltip (as in MessageRow)
    const displayTime = creation ? formatRelativeDate(creation) : ""

    return (
        // Mobile: sender + actions share the first row, the file name wraps to its
        // own full-width row. Desktop: all three sit side by side.
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            {user && (
                // flex-1 on BOTH side groups keeps the file name truly centered —
                // with justify-between alone it drifts toward the narrower side
                <div className="order-1 flex min-w-0 flex-1 items-center gap-2">
                    <UserAvatar user={user} size="md" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 className="truncate text-sm font-medium text-ink-gray-8">
                            {user.full_name || user.name}
                        </h3>
                        {displayTime && (
                            <Tooltip delayDuration={300}>
                                {/* asChild span: a focusable trigger would grab the
                                dialog's initial focus and auto-open the tooltip */}
                                <TooltipTrigger asChild>
                                    <span className="w-fit text-xs text-ink-gray-4">{displayTime}</span>
                                </TooltipTrigger>
                                <TooltipContent>{longTime}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            )}

            <div className="order-3 flex min-w-0 basis-full justify-center sm:p-0 p-2 flex-wrap items-center gap-2 sm:order-2 sm:basis-auto">
                <Tooltip>
                    {/* asChild span: a focusable trigger would grab the dialog's
                    initial focus and auto-open the tooltip */}
                    <TooltipTrigger asChild>
                        <span className="sm:max-w-96 text-center truncate text-base font-medium">{fileName}</span>
                    </TooltipTrigger>
                    <TooltipContent>{fileName}</TooltipContent>
                </Tooltip>
                {fileSize && (
                    <Badge variant="subtle" theme="gray">
                        {fileSize}
                    </Badge>
                )}
                {badge}
            </div>

            <div className="order-2 flex flex-1 shrink-0 items-center justify-end gap-2 sm:order-3">
                {children}
                {onDownload && (
                    <Button
                        variant="ghost"
                        size="md"
                        isIconButton
                        title={_("Download")}
                        aria-label={_("Download")}
                        onClick={onDownload}
                    >
                        <ArrowDownToLineIcon />
                    </Button>
                )}
                {onShare && (
                    <Button
                        variant="ghost"
                        size="md"
                        isIconButton
                        title={_("Share")}
                        aria-label={_("Share")}
                        onClick={onShare}
                    >
                        <Share2 />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="md"
                    isIconButton
                    title={_("Close")}
                    aria-label={_("Close")}
                    onClick={onClose}
                >
                    <X />
                </Button>
            </div>
        </div>
    )
}
