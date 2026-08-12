import { useHotkeys } from "react-hotkeys-hook"
import { getDefaultStore } from "jotai"
import { attachmentPreviewAtom } from "@utils/attachmentPreview"
import { messageDialogAtom } from "@utils/channelAtoms"

/** Live check: is any Esc-owning overlay open right now? Radix-style layers
 *  (dialogs, alert dialogs, bottom sheets, menus, open selects) plus the
 *  attachment lightbox and the message dialogs (state-checked, so markup
 *  changes can't break them). */
const overlayOpenNow = (): boolean => {
    const store = getDefaultStore()
    if (store.get(attachmentPreviewAtom) !== null) return true
    if (store.get(messageDialogAtom) !== null) return true
    return (
        document.querySelector(
            '[data-state="open"]:is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"])',
        ) !== null
    )
}

/**
 * Whether THIS Escape press belongs to a modal overlay.
 *
 * Why a capture-phase snapshot instead of a live check: Radix closes its top
 * layer from a CAPTURE keydown listener, and React flushes that state change
 * before bubble listeners run. So when a page-level Esc hotkey (bubble phase)
 * checks "is a modal open?", the modal is already gone — a live check always
 * says no, and the hotkey closes the page surface on the same press (verified
 * with logging: preview/dialog/DOM all read false while the modal was still
 * on screen). Capture listeners run in registration order, and this one is
 * registered at module load — before any Radix layer can mount and register
 * its own — so it always runs first and sees the modal while it exists.
 */
let escPressHadOverlay = false
if (typeof document !== "undefined") {
    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape") escPressHadOverlay = overlayOpenNow()
        },
        { capture: true },
    )
}

export const escOwnedByOverlay = (): boolean => escPressHadOverlay

type EscHotkeyOptions = {
    enabled?: boolean
    enableOnFormTags?: boolean
    enableOnContentEditable?: boolean
    preventDefault?: boolean
}

/**
 * Escape hotkey for PAGE-LEVEL surfaces (close a thread, a rail panel, a chat
 * pane). Automatically stands down while a modal overlay is open, so one Esc
 * press closes the modal only — not the surface underneath it too.
 *
 * Do NOT use this for handlers that live INSIDE a dialog (e.g. a form rendered
 * in a Dialog) — the open dialog would gate its own handler forever. Those
 * keep plain useHotkeys.
 */
export function useEscHotkey(handler: () => void, options?: EscHotkeyOptions, deps?: unknown[]) {
    useHotkeys(
        "esc",
        handler,
        {
            ...options,
            // A function, so the overlay check runs at keypress time — always
            // current, and preventDefault never fires while a modal is open.
            enabled: () => (options?.enabled ?? true) && !escOwnedByOverlay(),
        },
        deps,
    )
}
