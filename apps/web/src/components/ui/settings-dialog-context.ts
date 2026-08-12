import * as React from "react"

/**
 * The settings dialog's context + hook live in their OWN module on purpose:
 * a file that exports components AND a hook is not React Fast Refresh
 * eligible, and settings-dialog.tsx holds the panel chrome everyone edits —
 * mixing this hook into it made every edit there a full page reload.
 */

type SettingsDialogContextValue = {
    onClose?: VoidFunction
}

export const SettingsDialogContext = React.createContext<SettingsDialogContextValue>({})

/**
 * Exposes `onClose` to descendant panels so they can dismiss the dialog after
 * a successful save without prop-drilling.
 */
export const useSettingsDialog = () => React.useContext(SettingsDialogContext)
