import { useMemo, useRef, useState } from "react"
import dayjs from "dayjs"
import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { linkifyBeforeSend } from "@components/features/editor/linkifyOnSend"
import { useRavenEditor } from "@components/features/editor/useRavenEditor"
import { errorResponseToast } from "@components/ui/error-banner"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { fromServerDatetime, toServerDatetime, formatTimeLabel, getAvailableTimeOptions } from "./scheduleTime"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"

type UseScheduledMessageEditOptions = {
    /** Called after a successful save — the parent refreshes the list and exits edit mode. */
    onDone: () => void
    /** Called when the user cancels (Cancel button / Escape) — the parent exits edit mode. */
    onCancel: () => void
}

/**
 * All editing behavior for a scheduled message, shared by the inline editor and
 * the mobile sheet. Enter saves; Escape cancels and consumes the event. Saving
 * writes status: "Scheduled", reviving Failed rows.
 */
export const useScheduledMessageEdit = (row: ScheduledMessageRow, { onDone, onCancel }: UseScheduledMessageEditOptions) => {
    const isMobile = useIsMobile()
    const { updateDoc, loading } = useFrappeUpdateDoc()

    // Seed date + time from the row's scheduled time (local tz). The date is
    // normalized to midnight so the Calendar's midnight Dates compare cleanly.
    const [date, setDate] = useState<Date>(() => fromServerDatetime(row.scheduled_time).startOf("day").toDate())
    const [time, setTime] = useState(() => fromServerDatetime(row.scheduled_time).format("HH:mm"))

    // Today hides already-passed slots; other days offer the full list. The row's
    // time may also not sit on a half-hour boundary — prepend its exact HH:mm so the
    // Select still displays it as the seeded value (even a past one: it's the row's
    // CURRENT stored time, and saving still requires a future pick).
    const availableOptions = getAvailableTimeOptions(date)
    const offGridTime = availableOptions.some((option) => option.value === time) ? null : { value: time, label: formatTimeLabel(time) }
    const allTimeOptions = offGridTime ? [offGridTime, ...availableOptions] : availableOptions

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

    // Save gated on real text content (whitespace slips past editor.isEmpty) AND a
    // future delivery time — both re-checked in onSave too (the editor's Enter path
    // bypasses the Save button's disabled state).
    const canSave = !!editor && !editor.isEmpty && editor.getText().trim().length > 0 && picked.isAfter(dayjs())

    const onSave = () => {
        // In-flight guard: Enter calls this directly, bypassing the Save button.
        if (loading) return
        if (!editor || editor.isEmpty || editor.getText().trim().length === 0) return
        if (!picked.isAfter(dayjs())) return
        // Same send-time linkify as ChatInput / EditMessageComposer.
        linkifyBeforeSend(editor)
        // The status write revives a Failed row back to Scheduled (a no-op for rows
        // already Scheduled) — the backend only allows editing Failed rows this way.
        updateDoc("Raven Scheduled Message", row.name, {
            text: editor.getHTML(),
            scheduled_time: toServerDatetime(picked),
            status: "Scheduled",
        })
            .then(onDone)
            .catch((error) => errorResponseToast(_("Could not update message"), error))
    }
    submitRef.current = onSave

    return {
        editor,
        date,
        setDate,
        time,
        setTime,
        availableOptions,
        allTimeOptions,
        picked,
        canSave,
        loading,
        onSave,
        // Toolbar wiring: bump opens the link popover, reset stops it re-opening.
        linkSignal,
        onLinkConsumed: () => setLinkSignal(0),
    }
}
