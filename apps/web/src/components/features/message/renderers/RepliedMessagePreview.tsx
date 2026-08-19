import { RavenMessage } from "@raven/types/RavenMessaging/RavenMessage"
import { useUser } from "@hooks/useUser"
import { ChartColumnIcon } from "lucide-react"
import FileTypeIcon from "@components/common/FileIcons/FileTypeIcon"
import { getFileExtension, getFileName } from "@raven/lib/utils/operations"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card"
import _ from "@lib/translate"

/**
 * The snapshot of a replied-to message (matches the backend's replied_message_details
 * JSON). Plain text only — the backend deliberately does NOT store the HTML body here
 * (see RavenMessage.before_insert); `content` is what every client renders.
 */
export interface RepliedMessageDetails {
    content: string
    file: string
    message_type: RavenMessage["message_type"]
    owner: string
    creation: string
}

/**
 * The "what you're replying to" preview — sender line + a by-type summary (poll /
 * file / image / text). Shared by the message stream (ReplyMessage, a clickable
 * quote) and the composer (ReplyPreviewBanner, with a cancel button) so a replied
 * message reads identically in both. Callers own the surrounding chrome (quote bar
 * / card / click target / ✕).
 */
export const RepliedMessagePreview = ({ details }: { details: RepliedMessageDetails }) => {
    const user = useUser(details.owner)

    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm-medium text-ink-gray-5 dark:text-ink-gray-7">
                {_("Replying to {0}", [user?.full_name || user?.name || details.owner])}
            </span>
            <div className="text-xs text-ink-gray-5 dark:text-ink-gray-7 flex gap-1 flex-col">
                {details.message_type === "Poll" && (
                    <span className="flex items-center gap-1">
                        <ChartColumnIcon className="h-3.5 w-3.5" />
                        <span className="line-clamp-1 md:text-p-base text-p-lg">Poll: {details.content.split("\n")[0]}</span>
                    </span>
                )}

                {details.message_type === "File" && (
                    <span className="flex items-center gap-2">
                        <FileTypeIcon fileType={getFileExtension(details.file ?? "")} size="md" />
                        <span className="md:line-clamp-2 line-clamp-1 md:text-p-base text-p-lg">{getFileName(details.file)}</span>
                    </span>
                )}

                {details.message_type === "Image" && (
                    <span className="flex items-center gap-2">
                        <HoverCard>
                            <HoverCardTrigger>
                                <img src={details.file} alt={getFileName(details.file)} className="md:w-6 md:h-6 w-5 h-5 rounded-sm" />
                            </HoverCardTrigger>
                            <HoverCardContent className="p-0">
                                <img src={details.file} alt={getFileName(details.file)} className="w-full h-full object-cover rounded-lg" />
                            </HoverCardContent>
                        </HoverCard>
                        <span className="md:line-clamp-2 line-clamp-1 md:text-p-base text-p-lg">{getFileName(details.file)}</span>
                    </span>
                )}

                {/* Text messages only: the other types render their own summary above,
                    and `content` holds that same teaser (file name / poll question), so
                    keying this off the type avoids printing it twice. */}
                {details.message_type === "Text" && details.content && (
                    <span className="md:line-clamp-2 line-clamp-1 md:text-p-base text-p-lg">{details.content}</span>
                )}
            </div>
        </div>
    )
}
