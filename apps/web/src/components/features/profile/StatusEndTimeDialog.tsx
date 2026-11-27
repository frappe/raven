import { useState } from "react"
import { ResponsiveDialog, ResponsiveDialogHeader } from "@components/features/message/actions/dialogs/ResponsiveDialog"
import { ScheduleTimePicker } from "@components/features/schedule-send/ScheduleTimePicker"
import { availabilityLabel, useSetAvailability, type AvailabilityStatus } from "@hooks/useSetAvailability"
import _ from "@lib/translate"

/** "Choose date and time…" for a status end: a future date + time, confirmed with Set. */
export const StatusEndTimeDialog = ({
    open,
    onClose,
    title,
    onPick,
}: {
    open: boolean
    onClose: () => void
    title: string
    /** The picked end as a server datetime. */
    onPick: (endsAt: string) => void
}) => (
    <ResponsiveDialog open={open} onClose={onClose}>
        <ResponsiveDialogHeader title={title} description={_("Pick when this status ends.")} hideDescription />
        <ScheduleTimePicker
            label={_("Until")}
            confirmLabel={_("Set")}
            fieldsClassName=""
            onCancel={onClose}
            onConfirm={(pick) => {
                onPick(pick.serverTime)
                onClose()
            }}
        />
    </ResponsiveDialog>
)

/** Sets an availability with a picked end. Open while `availability` is set. */
export const AvailabilityEndTimeDialog = ({
    availability,
    onClose,
}: {
    availability: AvailabilityStatus | null
    onClose: () => void
}) => {
    const { setAvailability } = useSetAvailability()
    // The title keeps the last availability while the dialog animates closed.
    const [titled, setTitled] = useState(availability)
    if (availability && availability !== titled) setTitled(availability)
    return (
        <StatusEndTimeDialog
            open={!!availability}
            onClose={onClose}
            title={titled ? _("{0} until", [availabilityLabel(titled)]) : ""}
            onPick={(endsAt) => availability && setAvailability(availability, endsAt)}
        />
    )
}
