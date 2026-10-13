import { closeCloudSettings, openCloudSettings } from "@frappe-dev/cloud-sdk"
import { atom, getDefaultStore } from "jotai"
import { useEffect, useState } from "react"

/** True while the Cloud Settings dialog is on screen. The Esc hotkey gate
 *  (useEscHotkey) reads it, so Esc closes the dialog and not the page under it. */
export const cloudSettingsOpenAtom = atom(false)

/**
 * Frappe adds `cloud_settings` to boot on a pilot-managed site, and only marks it
 * enabled for users who hold the Cloud Settings role. Older Frappe has no key at
 * all. Reading boot means no request is ever made on a site that cannot show it.
 */
export const isCloudSettingsAvailable = (): boolean =>
    window.frappe?.boot?.cloud_settings?.enabled === true

/** Opens the Cloud Settings dialog on the billing panel. Rejects with the SDK's message. */
export const openBillingDialog = async (): Promise<void> => {
    const store = getDefaultStore()
    store.set(cloudSettingsOpenAtom, true)
    try {
        await openCloudSettings({
            panels: ["billing", "domains", "advanced"],
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
