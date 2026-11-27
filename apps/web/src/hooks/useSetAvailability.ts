import { useFrappePostCall, type FrappeError } from "frappe-react-sdk"
import { useAtomValue } from "jotai"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { errorResponseToast } from "@components/ui/error-banner"
import { useEffectiveStatus } from "@hooks/useEffectiveStatus"
import { formatStatusEnd } from "@lib/statusExpiry"
import { fromServerDatetime } from "@lib/timeUtils"
import _ from "@lib/translate"
import { timeFormatAtom } from "@utils/preferences"

/** The values `Raven User.availability_status` can hold (besides the "" default). */
export const availabilityOptions = () => [
    { value: "Available", label: _("Available") },
    { value: "Away", label: _("Away") },
    { value: "Do not disturb", label: _("Do not disturb") },
    { value: "Invisible", label: _("Invisible") },
] as const

export type AvailabilityStatus = ReturnType<typeof availabilityOptions>[number]["value"]

export const availabilityLabel = (status: AvailabilityStatus) =>
    availabilityOptions().find((option) => option.value === status)?.label ?? status

/**
 * Quick availability switching — the shared engine behind the footer's
 * long-press drawer, the desktop avatar menu and the command palette, so every
 * surface updates the same field the same way (the profile form included:
 * one set_value on Raven User, then revalidate my_profile).
 */
export const useSetAvailability = () => {
    const { myProfile, mutate } = useCurrentRavenUser()
    const status = useEffectiveStatus(myProfile)
    const timeFormat = useAtomValue(timeFormatAtom)
    const { call, loading } = useFrappePostCall("frappe.client.set_value")

    /** `endsAt` is a server datetime; without one the status stays until changed. */
    const setAvailability = async (availability: AvailabilityStatus, endsAt: string | null = null) => {
        if (!myProfile?.name) return
        try {
            await call({
                doctype: "Raven User",
                name: myProfile.name,
                // Sent together, so a new status never keeps the previous one's end time.
                fieldname: { availability_status: availability, availability_expires_at: endsAt },
            })
            await mutate()
            toast.success(
                endsAt
                    ? _("Status set to {0} until {1}", [availabilityLabel(availability), formatStatusEnd(fromServerDatetime(endsAt), timeFormat)])
                    : _("Status set to {0}", [availabilityLabel(availability)]),
            )
        } catch (e) {
            errorResponseToast(_("Could not update status"), e as FrappeError)
        }
    }

    return {
        availability: status?.availability ?? "",
        endsAt: status?.availabilityEndsAt ?? null,
        setAvailability,
        loading,
    }
}
