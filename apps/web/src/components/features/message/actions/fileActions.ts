import type { ReactNode } from "react"
import { Download, Link2, LucideIcon, Paperclip } from "lucide-react"
import { toast } from "sonner"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import type { MessageDialog } from "@utils/channelAtoms"
import { channelMessagesStore } from "@stores/messages/store"
import { hasFile } from "./fileMessage"
import { downloadBlob, downloadFile, getAbsoluteFileURL } from "@lib/file"
import { getFileName } from "@raven/lib/utils/operations"

export type MessageAction = {
    id: string
    label: string
    /** Absent on custom-action children — admin-defined entries render label-only. */
    icon?: LucideIcon
    /** Absent on a parent entry — those carry `children` or `submenu` instead. */
    onSelect?: () => void
    /** Nested ACTION ROWS: a submenu on desktop, a pushed drawer sub-view on
     *  mobile (the custom-actions list). */
    children?: MessageAction[]
    /**
     * Nested PANEL CONTENT (read receipts): a real submenu in the desktop
     * context menu / hover dropdown — hosts supply their own wrapper, this is
     * just the panel's content. The mobile sheet ignores it and runs onSelect,
     * so actions carrying `submenu` must also say what a tap does on a phone
     * (usually: open the same content as its own bottom sheet).
     */
    submenu?: () => ReactNode
    /** Renders in the destructive style (delete). */
    danger?: boolean
}

/**
 * Builds the file actions for a message: copy file link, download (single
 * file), download all (batch zip), and attach to document. Rendered by
 * useMessageActions as its own group (a divider above them on every
 * surface), separate from the copy/copy-link clipboard actions. Extracted
 * from useMessageActions to keep that hook under the repo's file-length
 * budget — a pure builder with no React hooks, closing only over `message`
 * and the caller's dialog opener.
 */
export const buildFileActions = (
    message: Message,
    deps: {
        setDialog: (value: MessageDialog) => void
    },
): MessageAction[] => {
    const { setDialog } = deps
    const actions: MessageAction[] = []

    // The file set comes from the BATCH, never from `message` itself. Two reasons:
    // a captioned send appends its Text caption as the batch's LAST member, and
    // blockFromEvent (MessageActionMenu) retargets a batch to that last member — so
    // `message` is frequently the caption, carrying no file at all. And every v3 send
    // stamps a message_batch_id (ChatInput.tsx) even for a lone file, so "has no batch
    // id" does not mean "is a single file".
    //
    // copy-file-link and download need one unambiguous file, hence `singleFile`.
    // Attach-to-document doesn't: its dialog resolves the batch itself into a
    // checklist (same pattern as delete), so it only needs to know a file exists.
    const fileMessages = (
        message.message_batch_id
            ? channelMessagesStore.batchMembers(message.channel_id, message.message_batch_id)
            : [message]
    ).filter(hasFile)
    const singleFile = fileMessages.length === 1 ? fileMessages[0] : null

    if (singleFile) {
        const absoluteURL = getAbsoluteFileURL(singleFile.file)
        const fileName = getFileName(singleFile.file)

        actions.push({
            id: "copy-file-link",
            label: _("Copy file link"),
            icon: Link2,
            onSelect: () => {
                navigator.clipboard
                    .writeText(absoluteURL)
                    .then(() => toast.success(_("File link copied")))
                    .catch(() => toast.error(_("Could not copy link")))
            },
        })

        actions.push({
            id: "download",
            label: _("Download"),
            icon: Download,
            // A plain anchor download on EVERY platform, mobile included. Routing mobile
            // through the Web Share sheet was the original design, on the belief that iOS
            // ignores the `download` attribute — but it fails in a phone PWA for a
            // different reason: shareFile has to fetch the whole file into a File object
            // before it can call navigator.share, and awaiting that fetch outlives the
            // tap's transient activation. Safari then refuses the share, refuses the URL
            // share, and refuses the clipboard fallback too, so the action ends in an
            // error toast having done nothing. An anchor click needs no await and no
            // activation, and iOS has honoured `download` for same-origin URLs since 13.
            // The share sheet still belongs to the explicit Share buttons on file pills
            // and in the lightbox, where sharing IS the intent.
            onSelect: () => downloadFile(absoluteURL, fileName),
        })
    }

    // More than one file: a single zip, built server-side. N separate browser
    // downloads is the obvious alternative and the wrong one — Chrome interrupts
    // with a "Download multiple files?" prompt and Safari commonly honours only
    // the first. One zip is an ordinary download everywhere.
    if (fileMessages.length > 1) {
        actions.push({
            id: "download-all",
            label: _("Download all ({0})", [`${fileMessages.length}`]),
            icon: Download,
            onSelect: () => {
                const ids = fileMessages.map((fileMessage) => fileMessage.name)
                const endpoint = `/api/method/raven.api.raven_message.download_batch_files?message_ids=${encodeURIComponent(
                    JSON.stringify(ids),
                )}`
                fetch(endpoint, { credentials: "include" })
                    .then(async (response) => {
                        if (!response.ok) throw new Error(String(response.status))
                        // The server names the zip after the channel; fall back only if
                        // the header is missing.
                        const disposition = response.headers.get("Content-Disposition") ?? ""
                        const named = disposition.match(/filename="?([^";]+)"?/)
                        downloadBlob(await response.blob(), named?.[1] ?? "raven-files.zip")
                    })
                    .catch(() => toast.error(_("Could not download files")))
            },
        })
    }

    if (fileMessages.length > 0) {
        actions.push({
            id: "attach-document",
            label: _("Attach to document"),
            icon: Paperclip,
            onSelect: () => setDialog({ type: "attach-document", message }),
        })
    }

    return actions
}
