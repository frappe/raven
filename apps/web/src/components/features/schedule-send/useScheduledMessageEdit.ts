import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react"
import dayjs from "dayjs"
import { FrappeConfig, FrappeContext, useFrappeUpdateDoc } from "frappe-react-sdk"
import { getDefaultStore, useAtomValue } from "jotai"
import { RESET, selectAtom } from "jotai/utils"
import { linkifyBeforeSend } from "@components/features/editor/linkifyOnSend"
import { useRavenEditor } from "@components/features/editor/useRavenEditor"
import { useEditorState } from "@tiptap/react"
import { errorResponseToast } from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"
import { timeFormatAtom } from "@utils/preferences"
import { getFileName } from "@raven/lib/utils/operations"
import {
    EPHEMERAL_UPLOADS_PREFIX, preparingFilesAtom, uploadedFilesAtom, uploadingFilesAtom, useAttachFile, type UploadedFile,
} from "@components/features/ChatInput/useFileInput"
import _ from "@lib/translate"
import { fromServerDatetime, toServerDatetime, getAvailableTimeOptions } from "@lib/timeUtils"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"

type UseScheduledMessageEditOptions = {
    /** Called after a successful save — the parent refreshes the list and exits edit mode. */
    onDone: () => void
    /** Called when the user cancels (Cancel button / Escape) — the parent exits edit mode. */
    onCancel: () => void
}

/** The row's stored files as staged uploads. No fileID, so removing one never deletes the server File. */
const toStagedFiles = (row: ScheduledMessageRow): UploadedFile[] => row.files.map((file, index) => ({
    fileID: "",
    fileURL: file.file_url,
    id: `${index}:${file.file_url}`,
    fileName: getFileName(file.file_url),
    size: file.file_size ?? 0,
    timestamp: 0,
    width: file.width,
    height: file.height,
}))

/**
 * All editing behavior for a scheduled message, shared by the inline editor and
 * the mobile sheet. Enter saves; Escape cancels and consumes the event. Saving
 * writes status: "Scheduled", reviving Failed rows.
 */
export const useScheduledMessageEdit = (row: ScheduledMessageRow, { onDone, onCancel }: UseScheduledMessageEditOptions) => {
    const isMobile = useIsMobile()
    const timeFormat = useAtomValue(timeFormatAtom)
    const { updateDoc, loading } = useFrappeUpdateDoc()
    const { db } = useContext(FrappeContext) as FrappeConfig

    // The composer's upload stack under a key of its own, kept in memory: the edit
    // seeds its files on open, and another tab editing the same row mustn't share them.
    const editKey = `${EPHEMERAL_UPLOADS_PREFIX}scheduled-edit:${row.name}`
    const uploadedFiles = useAtomValue(uploadedFilesAtom(editKey))
    // A boolean, not the list: progress ticks rewrite the list and would re-render the editor.
    const isUploading = useAtomValue(
        useMemo(() => selectAtom(uploadingFilesAtom(editKey), (files) => files.length > 0), [editKey]),
    )
    const isPreparing = useAtomValue(preparingFilesAtom(editKey)).length > 0
    const onAddFile = useAttachFile(editKey)
    // One editKey per mount (the sheet is keyed by row), so the first onAddFile stays valid.
    const filesRef = useRef(onAddFile)

    // Seed the stored files on open. Leaving without saving deletes this session's
    // uploads (they carry a fileID); once a save is sent, the row may reference them.
    const keepUploadsRef = useRef(false)
    useLayoutEffect(() => {
        const store = getDefaultStore()
        store.set(uploadedFilesAtom(editKey), toStagedFiles(row))
        return () => {
            if (!keepUploadsRef.current) {
                for (const file of store.get(uploadedFilesAtom(editKey))) {
                    if (file.fileID) db.deleteDoc("File", file.fileID).catch(() => { })
                }
            }
            store.set(uploadedFilesAtom(editKey), RESET)
            store.set(uploadingFilesAtom(editKey), [])
            store.set(preparingFilesAtom(editKey), [])
        }
        // Seeded once per opened edit; a refetched row mustn't wipe what the user changed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editKey])

    const [replyDropped, setReplyDropped] = useState(false)
    const [docDropped, setDocDropped] = useState(false)
    const [sendSilently, setSendSilently] = useState(!!row.send_silently)
    const keepsDoc = !docDropped && !!row.link_doctype && !!row.link_document

    // Seed from the row's scheduled time (local tz), date normalized to midnight
    // for the Calendar. A past stored time (overdue / Failed row) seeds today's
    // next slot instead — keeping it would open the editor with Save already dead.
    const [date, setDate] = useState<Date>(() => {
        const stored = fromServerDatetime(row.scheduled_time)
        return (stored.isAfter(dayjs()) ? stored : dayjs()).startOf("day").toDate()
    })
    const [time, setTime] = useState(() => {
        const stored = fromServerDatetime(row.scheduled_time)
        if (stored.isAfter(dayjs())) return stored.format("HH:mm")
        return getAvailableTimeOptions(new Date(), timeFormat)[0]?.value ?? "09:00"
    })

    // A date change back to today can strand the selected time in the past —
    // snap to the next open slot.
    const pickDate = (next: Date) => {
        setDate(next)
        const [hours, minutes] = time.split(":").map(Number)
        if (!dayjs(next).hour(hours).minute(minutes).isAfter(dayjs())) {
            const first = getAvailableTimeOptions(next, timeFormat)[0]
            if (first) setTime(first.value)
        }
    }

    // Today hides already-passed slots; other days offer the full list. The row's
    // time may sit off the 15-min grid, so it is included as its own option and the
    // Select keeps showing the seeded value.
    const allTimeOptions = getAvailableTimeOptions(date, timeFormat, dayjs(), time)

    // submit/cancel are read through refs by the editor's (build-once) keydown
    // closure, so reassigning them each render keeps Enter/Escape calling the
    // latest handlers. Escape cancels AND consumes the event (useRavenEditor stops
    // propagation) so the parent dialog doesn't close on the same key.
    const submitRef = useRef<() => void>(() => { })
    const cancelRef = useRef<() => boolean>(() => false)
    cancelRef.current = () => {
        onCancel()
        return true
    }

    // ⌘⇧U opens the formatting toolbar's link popover: linkRef bumps a signal the
    // toolbar watches (reset via onLinkConsumed so re-renders don't reopen it).
    const [linkSignal, setLinkSignal] = useState(0)
    const linkRef = useRef<() => void>(() => { })
    linkRef.current = () => setLinkSignal((n) => n + 1)

    const editor = useRavenEditor({
        submitRef,
        cancelReplyRef: cancelRef,
        linkRef,
        filesRef,
        content: row.text,
        // Keyboard stays closed until the user taps the editor on mobile (a sheet
        // opening with the keyboard up covers its own controls).
        autofocus: !isMobile,
        placeholder: _("Edit message..."),
    })

    // Local datetime formed from the picked date + time (date is always set).
    const picked = useMemo(() => {
        const [hours, minutes] = time.split(":").map(Number)
        return dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0)
    }, [date, time])

    // Save needs a future time, settled uploads, and something to send: real text
    // (whitespace slips past editor.isEmpty), a file or a kept document. Text is read
    // through useEditorState because typing doesn't re-render this hook.
    const pastPick = !picked.isAfter(dayjs())
    const hasText = useEditorState({
        editor,
        selector: ({ editor: e }) => !!e && !e.isEmpty && e.getText().trim().length > 0,
    })
    const canSave = !!editor && !pastPick && !isUploading && !isPreparing && (hasText || uploadedFiles.length > 0 || keepsDoc)

    const onSave = () => {
        // Enter calls this directly, bypassing the Save button's disabled state.
        if (loading || !editor || !canSave) return
        // Same send-time linkify as ChatInput / EditMessageComposer.
        if (hasText) linkifyBeforeSend(editor)
        keepUploadsRef.current = true
        // The status write revives a Failed row back to Scheduled (a no-op for rows
        // already Scheduled) — the backend only allows editing Failed rows this way.
        updateDoc("Raven Scheduled Message", row.name, {
            text: hasText ? editor.getHTML() : "",
            scheduled_time: toServerDatetime(picked),
            status: "Scheduled",
            send_silently: sendSilently ? 1 : 0,
            files: uploadedFiles.map((file) => ({
                file_url: file.fileURL, file_size: file.size, width: file.width, height: file.height,
            })),
            linked_message: replyDropped ? null : row.linked_message ?? null,
            link_doctype: keepsDoc ? row.link_doctype : null,
            link_document: keepsDoc ? row.link_document : null,
        })
            .then(onDone)
            .catch((error) => {
                keepUploadsRef.current = false
                errorResponseToast(_("Could not update message"), error)
            })
    }
    submitRef.current = onSave

    return {
        editor,
        editKey,
        replyDropped,
        dropReply: () => setReplyDropped(true),
        keepsDoc,
        dropDoc: () => setDocDropped(true),
        sendSilently,
        setSendSilently,
        date,
        setDate: pickDate,
        time,
        setTime,
        allTimeOptions,
        timeFormat,
        picked,
        pastPick,
        canSave,
        loading,
        onSave,
        // Toolbar wiring: bump opens the link popover, reset stops it re-opening.
        linkSignal,
        onLinkConsumed: () => setLinkSignal(0),
    }
}

export type ScheduledMessageEdit = ReturnType<typeof useScheduledMessageEdit>
