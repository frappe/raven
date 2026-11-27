import { useEffect, useRef } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { SelectFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import { useStatusUntilLabel } from "@components/common/StatusUntil"
import { StatusEndTimeDialog } from "@components/features/profile/StatusEndTimeDialog"
import { getStatusDurations } from "@lib/statusExpiry"
import _ from "@lib/translate"
import type { StatusFormValues } from "./statusForm"

/**
 * "Clear after" for the written status, shared by the desktop panel and the mobile sheet.
 * Hidden while the status is empty. Editing the text moves it to Today until the user picks
 * one themselves.
 */
export const ClearAfterField = ({ triggerClassName }: { triggerClassName?: string }) => {
    const { control, setValue, getValues, formState } = useFormContext<StatusFormValues>()
    const [customStatus, clearAfter, clearAfterAt] = useWatch({ control, name: ["custom_status", "clear_after", "clear_after_at"] })
    const untilLabel = useStatusUntilLabel(clearAfterAt)
    // Restored when the date picker closes without a pick.
    const beforePicking = useRef(clearAfter)
    // The person's own choice, even one equal to the seed, stops the text from moving it.
    const picked = useRef(false)

    const seededStatus = formState.defaultValues?.custom_status
    const seededClearAfter = formState.defaultValues?.clear_after
    // A changed seed (a reopen, or a save that changed the text or choice) lets edits move it again.
    useEffect(() => {
        picked.current = false
    }, [seededStatus, seededClearAfter])
    useEffect(() => {
        if (picked.current) return
        setValue("clear_after", customStatus !== seededStatus ? "today" : (seededClearAfter ?? "never"))
    }, [customStatus, seededStatus, seededClearAfter, setValue])

    useEffect(() => {
        if (clearAfter !== "custom") beforePicking.current = clearAfter
    }, [clearAfter])

    if (!customStatus?.trim()) return null

    return (
        <>
            <SelectFormField
                name="clear_after"
                label={_("Clear after")}
                triggerClassName={triggerClassName}
                onValueChange={() => {
                    picked.current = true
                }}
            >
                {untilLabel && <SelectItem value="at">{untilLabel}</SelectItem>}
                {getStatusDurations().map((duration) => (
                    <SelectItem key={duration.id} value={duration.id}>
                        {duration.label}
                    </SelectItem>
                ))}
            </SelectFormField>
            <StatusEndTimeDialog
                // Open while "Choose date and time…" is selected; a pick replaces it with "at".
                open={clearAfter === "custom"}
                onClose={() => {
                    if (getValues("clear_after") === "custom") setValue("clear_after", beforePicking.current)
                }}
                title={_("Clear status after")}
                onPick={(endsAt) => {
                    picked.current = true
                    setValue("clear_after_at", endsAt, { shouldDirty: true })
                    setValue("clear_after", "at", { shouldDirty: true })
                }}
            />
        </>
    )
}
