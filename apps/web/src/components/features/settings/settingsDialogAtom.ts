import { atom } from "jotai"
import type { SettingsTabId } from "./SettingsDialog"

/**
 * Which settings tab is open ("" = dialog closed). Lives in its OWN module on
 * purpose: a file that exports components AND an atom is not React Fast
 * Refresh eligible, and this atom used to live in SettingsDialog.tsx — making
 * every edit there a full page reload. The type-only import back into
 * SettingsDialog is erased at runtime, so there is no import cycle.
 */
export const settingsDialogOpenTab = atom<"" | SettingsTabId>("")
