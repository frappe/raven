import { useFrappePostCall, type FrappeError } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { errorResponseToast } from "@components/ui/error-banner"
import _ from "@lib/translate"

/** The values `Raven User.availability_status` can hold (besides the "" default). */
export const AVAILABILITY_OPTIONS = [
    { value: "Available", label: _("Available") },
    { value: "Away", label: _("Away") },
    { value: "Do not disturb", label: _("Do not disturb") },
    { value: "Invisible", label: _("Invisible") },
] as const

export type AvailabilityStatus = (typeof AVAILABILITY_OPTIONS)[number]["value"]

/**
 * Quick availability switching — the shared engine behind the footer's
 * long-press drawer, the desktop avatar menu and the command palette, so every
 * surface updates the same field the same way (the profile form included:
 * one set_value on Raven User, then revalidate my_profile).
 */
export const useSetAvailability = () => {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call, loading } = useFrappePostCall("frappe.client.set_value")

    const setAvailability = async (status: AvailabilityStatus) => {
        if (!myProfile?.name) return
        try {
            await call({ doctype: "Raven User", name: myProfile.name, fieldname: { availability_status: status } })
            await mutate()
            toast.success(_("Status set to {0}", [_(status)]))
        } catch (e) {
            errorResponseToast(_("Could not update status"), e as FrappeError)
        }
    }

    return { availability: myProfile?.availability_status ?? "", setAvailability, loading }
}
