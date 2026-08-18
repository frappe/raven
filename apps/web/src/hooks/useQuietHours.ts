import { useEffect, useState } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { errorResponseToast } from "@components/ui/error-banner"
import { quietHoursConfigAtom, quietHoursNudgeAtom, type QuietHoursNudge } from "@utils/preferences"
import { isInQuietHours } from "@utils/quietHours"
import _ from "@lib/translate"

/**
 * Reactive "are we in quiet hours right now" — re-evaluated once a minute, on
 * tab visibility (a phone waking hours later must not keep the stale answer),
 * and when the config itself changes (an admin saving working hours applies
 * live in their session). Without a config, no timer runs and this is
 * constant false.
 */
export const useIsInQuietHours = (): boolean => {
    const config = useAtomValue(quietHoursConfigAtom)
    const [quiet, setQuiet] = useState(isInQuietHours)

    useEffect(() => {
        // Re-evaluate right away on a config change — enabling quiet hours at
        // 11pm should take effect now, not at the next minute tick. A bailed
        // setState makes the no-change case free.
        setQuiet(isInQuietHours())
        if (!config) return
        const update = () => setQuiet(isInQuietHours())
        const interval = window.setInterval(update, 60_000)
        document.addEventListener("visibilitychange", update)
        return () => {
            window.clearInterval(interval)
            document.removeEventListener("visibilitychange", update)
        }
    }, [config])

    return quiet
}

/**
 * Save the user's quiet-hours preference: writes the Raven User field and
 * mirrors into the boot-seeded atom, so the composer (banner, send button)
 * reacts in place. Shared by the Preferences panel row and the banner's
 * inline menu.
 */
export const useSetQuietHoursNudge = () => {
    const { myProfile, mutate } = useCurrentRavenUser()
    const setAtom = useSetAtom(quietHoursNudgeAtom)
    const { call } = useFrappePostCall("frappe.client.set_value")

    return (value: QuietHoursNudge) => {
        if (!myProfile?.name) return
        call({
            doctype: "Raven User",
            name: myProfile.name,
            fieldname: "quiet_hours_nudge",
            value,
        })
            .then(() => {
                setAtom(value)
                mutate()
                toast.success(_("Settings updated"), { id: "preferences-updated" })
            })
            .catch((e) => {
                errorResponseToast(_("Could not update preference"), e)
            })
    }
}

export type QuietSendMode = "nudge" | "auto" | undefined

/**
 * The composer's quiet-hours mode, combining the org clock with the user's
 * preference: "nudge" advertises silent sending, "auto" flips the send
 * default to silent, undefined = leave sends alone (not quiet time, feature
 * off, or the user opted out).
 */
export const useQuietSendMode = (): QuietSendMode => {
    const quiet = useIsInQuietHours()
    const preference = useAtomValue(quietHoursNudgeAtom)
    if (!quiet || preference === "No Nudge") return undefined
    return preference === "Auto Silent" ? "auto" : "nudge"
}
