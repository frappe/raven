import { lazy, Suspense, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { isFrappeSetupComplete, isSetupPending, setupDoneStorageKey } from "@utils/setup"
import { getSetupMode, type SetupMode } from "./setupMode"

const SetupPage = lazy(() => import("./SetupPage"))

const currentMode = (): SetupMode =>
    getSetupMode({ setupPending: isSetupPending(), onboarded: !!window.frappe?.boot?.raven_onboarded })

/** Opens the first admin's setup, or a new user's profile step, until each is done. Frappe's own setup wizard runs first. */
export const SetupGate = () => {
    const [mode, setMode] = useState<SetupMode>(currentMode)

    // Admin setup finished in another tab: close here too, or this tab would offer to make it all again.
    // That flow onboarded the user too; this tab's boot flag just hasn't heard.
    useEffect(() => {
        if (mode !== "admin") return
        const onStorage = (event: StorageEvent) => {
            if (event.key === setupDoneStorageKey() && event.newValue === "1") setMode(null)
        }
        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [mode])

    if (!mode) return null
    // A Frappe Cloud signup opens Raven before the Framework wizard; finishing Raven's setup completes it too.
    const needsFrappeWizard = !isFrappeSetupComplete() && !window.frappe?.boot?.is_fc_site
    if (mode === "admin" && needsFrappeWizard) return <FrappeSetupRedirect />
    return (
        <Suspense fallback={<SetupCover />}>
            {/* Either flow starts with the profile step, which onboards the user, so finishing closes it for good. */}
            <SetupPage mode={mode} onFinished={() => setMode(null)} />
        </Suspense>
    )
}

/** Hides the app while the setup page's chunk loads; otherwise it shows through for a moment on a reload. */
const SetupCover = () => createPortal(<div aria-hidden className="fixed inset-0 z-50 bg-surface-base" />, document.body)

/** Desk sends the user on to Frappe's setup wizard while that's incomplete. */
const FrappeSetupRedirect = () => {
    useEffect(() => window.location.replace("/app"), [])
    return null
}
