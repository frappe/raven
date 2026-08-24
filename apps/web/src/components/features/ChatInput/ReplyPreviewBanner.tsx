import { XCircleIcon } from "lucide-react"
import type { Message } from "@raven/types/common/Message"
import { Button } from "@components/ui/button"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { RepliedMessagePreview, type RepliedMessageDetails } from "@components/features/message/renderers/RepliedMessagePreview"
import { useIsMobile } from "@hooks/use-mobile"

/** Map the live target Message to the snapshot shape the shared preview expects. */
const toDetails = (message: Message): RepliedMessageDetails => ({
    content: message.content ?? "",
    file: (message as Message & { file?: string }).file ?? "",
    message_type: message.message_type,
    owner: message.owner,
    creation: message.creation,
})

/**
 * Shown at the top of the composer while replying — the shared replied-message
 * preview plus a ✕ to cancel. The composer threads the target through the send as
 * linked_message; this is purely the contextual header.
 */
export const ReplyPreviewBanner = ({
    message,
    onCancel,
    showFormatting,
}: {
    message: Message
    onCancel: () => void
    showFormatting: boolean
}) => {

    const isMobile = useIsMobile()
    return (
        <div className={cn("flex items-center gap-2 bg-surface-gray-1 md:px-3 md:py-2.5", showFormatting && "m-2 rounded")}>
            <div className="min-w-0 flex-1 md:border-l-2 border-l-4 md:py-0 py-2 md:border-outline-gray-3 border-outline-gray-4 pl-2">
                <RepliedMessagePreview details={toDetails(message)} />
            </div>
            <Button type="button" variant="ghost" size={isMobile ? "lg" : "md"}
                className="active:bg-transparent"
                isIconButton aria-label={_("Cancel reply")} onClick={onCancel}>
                <XCircleIcon />
            </Button>
        </div>
    )
}
