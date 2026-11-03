import { closeCloudSettings, openCloudSettings } from "@frappe/cloud-sdk"
import { atom, getDefaultStore } from "jotai"
import { useEffect, useState } from "react"
import { isFrappeCloudV2Site } from "@lib/frappe"

/** True while the Cloud Settings dialog is on screen. The Esc hotkey gate
 *  (useEscHotkey) reads it, so Esc closes the dialog and not the page under it. */
export const cloudSettingsOpenAtom = atom(false)

/** Reading boot means no request is ever made on a site that cannot show Cloud Settings. */
export const isCloudSettingsAvailable = (): boolean =>
    // The SDK calls the site by relative URL with cookies; the native app's page is not on the site.
    !import.meta.env.VITE_NATIVE && isFrappeCloudV2Site()

/** Opens the Cloud Settings dialog on the billing panel. Rejects with the SDK's message. */
export const openBillingDialog = async (): Promise<void> => {
    const store = getDefaultStore()
    store.set(cloudSettingsOpenAtom, true)
    try {
        await openCloudSettings({
            panels: ["billing", "marketplace", "domains", "advanced"],
            tab: "billing",
            // Follows the `dark` class Raven's ThemeProvider puts on <html>.
            theme: "auto",
            onClose: () => store.set(cloudSettingsOpenAtom, false),
        })
    } catch (error) {
        store.set(cloudSettingsOpenAtom, false)
        throw error
    }
}

export const useCloudSettings = () => {
    const [opening, setOpening] = useState(false)

    // The dialog belongs to the menu that opened it: take it down with the menu.
    useEffect(
        () => () => {
            closeCloudSettings()
            getDefaultStore().set(cloudSettingsOpenAtom, false)
        },
        [],
    )

    const open = async () => {
        if (opening) return
        setOpening(true)
        try {
            await openBillingDialog()
        } finally {
            setOpening(false)
        }
    }

    return { available: isCloudSettingsAvailable(), opening, open }
}
