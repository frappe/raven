import { useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { BellOffIcon, MessageSquareTextIcon } from "lucide-react"
import { MessageBody } from "@components/features/message/renderers/MessageContent"
import { RepliedMessagePreview } from "@components/features/message/renderers/RepliedMessagePreview"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { FileSummary, InputFileList } from "@components/features/ChatInput/InputFiles"
import { LinkedDocumentChip } from "@components/features/ChatInput/AttachFrappeDocumentDialog"
import { ReplyPreviewBanner } from "@components/features/ChatInput/ReplyPreviewBanner"
import { attachmentPreviewAtom, getAttachmentKind, stagedFilesToAttachments } from "@utils/attachmentPreview"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { fromServerDatetime } from "@lib/timeUtils"
import { getFileName } from "@raven/lib/utils/operations"
import _ from "@lib/translate"
import { scheduledMessagesDialogOpenAtom } from "./useScheduledMessages"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"
import type { ScheduledMessageEdit } from "./useScheduledMessageEdit"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import type { UserData } from "@db"

const Dot = () => <span className="shrink-0 text-ink-gray-4" aria-hidden>·</span>

/** Bell-off beside the delivery time when the row sends without notification. */
export const SilentMark = () => (
    <>
        <BellOffIcon className="size-3.5 shrink-0 text-ink-gray-5" aria-hidden />
        <span className="sr-only">{_("Sends without notification")}</span>
    </>
)

type DestinationProps = {
    row: ScheduledMessageRow
    /** For a thread row, the channel the thread lives in. */
    channel?: ChannelListItem
    workspace?: WorkspaceFields
    dmChannel?: DMChannelListItem
    peer?: UserData
}

/** The context band's destination: the channel or DM peer, a thread that opens on click, or the deleted state. */
export const ScheduledMessageDestination = ({ row, channel, workspace, dmChannel, peer }: DestinationProps) => {
    const navigate = useNavigate()
    const setDialogOpen = useSetAtom(scheduledMessagesDialogOpenAtom)

    if (row.channel_deleted) {
        return <><Dot /><span className="truncate min-w-0">{_("Deleted channel")}</span></>
    }

    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ""
    const workspaceLabel = channel && workspace && (
        <><Dot /><span className="truncate text-xs">{workspace.workspace_name}</span></>
    )

    if (row.thread_parent_channel) {
        const base = channel
            ? `/${encodeURIComponent(channel.workspace ?? "")}/${encodeURIComponent(channel.name)}`
            : dmChannel && `/dm-channel/${encodeURIComponent(dmChannel.name)}`
        const threadID = encodeURIComponent(row.channel_id)
        // The parent can be missing from your lists, e.g. after leaving it.
        const label = channel
            ? _("Thread in {0}", [channel.channel_name])
            : peerName ? _("Thread with {0}", [peerName]) : _("Thread")
        return (
            <>
                <Dot />
                {base ? (
                    <button
                        type="button"
                        // The after: layer stretches the tap target to the band's full height.
                        className="relative flex min-w-0 cursor-pointer items-center gap-1 rounded-sm hover:text-ink-gray-8 hover:underline after:absolute after:inset-x-0 after:-inset-y-2.5 md:after:-inset-y-1"
                        onClick={(event) => {
                            // The mobile row tap opens the action sheet; this tap opens the thread instead.
                            event.stopPropagation()
                            setDialogOpen(false)
                            navigate(`${base}/thread/${threadID}?message_id=${threadID}`)
                        }}
                    >
                        <MessageSquareTextIcon className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                    </button>
                ) : (
                    <span className="truncate min-w-0">{label}</span>
                )}
                {workspaceLabel}
            </>
        )
    }

    if (channel) {
        return (
            <>
                <Dot />
                <ChannelIcon type={channel.type} className="size-3.5 shrink-0 text-ink-gray-6" />
                <span className="text-sm min-w-0 -ml-0.5">{channel.channel_name}</span>
                {workspaceLabel}
            </>
        )
    }

    return dmChannel ? (
        <>
            <Dot />
            {/* The person's avatar, the way DMs are shown everywhere else. */}
            {peer && <UserAvatar user={peer} size="xs" showStatusIndicator={false} />}
            <span className="truncate min-w-0">{peerName}</span>
        </>
    ) : null
}

/** What a scheduled message carries; the custom picker's preview builds one from the composer. */
export type ScheduledPayload = Pick<ScheduledMessageRow, "text" | "files" | "reply_preview" | "link_doctype" | "link_document">
    & { scheduled_time?: string }

/** The scheduled payload in message order: reply quote, text, files, linked document. */
export const ScheduledMessageBody = ({ row }: { row: ScheduledPayload }) => (
    <div className="flex flex-col gap-2">
        {row.reply_preview && (
            // ReplyMessage's quote look, without its jump-to-original click.
            <div className="border-l-2 border-outline-gray-3 bg-surface-gray-1 pl-3 pr-2 py-2">
                <RepliedMessagePreview details={row.reply_preview} />
            </div>
        )}
        {row.text && (
            <div className="[&_p]:my-0">
                <MessageBody content={row.text} />
            </div>
        )}
        {row.files.length > 0 && <ScheduledFiles row={row} />}
        {row.link_doctype && row.link_document && (
            <LinkedDocumentChip document={{ doctype: row.link_doctype, docname: row.link_document }} />
        )}
    </div>
)

/** The row's files as chips; each opens the attachment viewer, which also shows a truncated name in full. */
const ScheduledFiles = ({ row }: { row: ScheduledPayload }) => {
    const setPreview = useSetAtom(attachmentPreviewAtom)
    const { name: currentUser } = useUserCookieData()
    // The viewer header's time: a card's delivery time; the picker preview has none, so now.
    const timestamp = row.scheduled_time ? fromServerDatetime(row.scheduled_time).valueOf() : Date.now()
    const files = row.files.map((file, index) => ({
        id: `${index}:${file.file_url}`,
        fileName: getFileName(file.file_url),
        fileURL: file.file_url,
        size: file.file_size ?? 0,
        timestamp,
    }))
    return (
        <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
                <div key={file.id} className="relative flex items-center gap-2 rounded-md border border-outline-gray-2 p-2 hover:bg-surface-gray-1 md:w-64 w-full">
                    <FileSummary
                        name={file.fileName}
                        size={file.size}
                        imageSrc={getAttachmentKind(file.fileURL) === "image" ? file.fileURL : undefined}
                    />
                    {/* A stretched button, not a wrapper: FileSummary's heading can't sit inside a <button>. */}
                    <button
                        type="button"
                        aria-label={_("Preview {0}", [file.fileName])}
                        className="absolute inset-0 cursor-pointer rounded-md"
                        onClick={(event) => {
                            // The mobile row tap opens the action sheet; this tap opens the file.
                            event.stopPropagation()
                            setPreview({ attachments: stagedFilesToAttachments(files, currentUser), index, mode: "preview" })
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

type EditPayloadProps = {
    row: ScheduledMessageRow
    edit: ScheduledMessageEdit
    /** Inset the reply banner like the composer does under its formatting toolbar. */
    showFormatting: boolean
}

/** Reply, linked document and files of an edit, in the composer's order; each can be removed. */
export const EditPayload = ({ row, edit, showFormatting }: EditPayloadProps) => (
    <>
        {row.linked_message && !edit.replyDropped && (
            <ReplyPreviewBanner details={row.reply_preview ?? null} onCancel={edit.dropReply} showFormatting={showFormatting} />
        )}
        {edit.keepsDoc && row.link_doctype && row.link_document && (
            // InputFileList's strip paddings, as in the composer.
            <div className="px-2 md:pt-2 pt-0 pb-2 md:pb-0">
                <LinkedDocumentChip document={{ doctype: row.link_doctype, docname: row.link_document }} onRemove={edit.dropDoc} />
            </div>
        )}
        <InputFileList channelID={edit.editKey} />
    </>
)
