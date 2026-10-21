import { useHotkeys } from "react-hotkeys-hook"

/**
 * mod+B creates a new record from a settings list — the same chord desk uses for "New".
 * Only list views register it, so it never competes with the editor's bold shortcut.
 */
export const useCreateHotkey = (create: () => void, enabled = true) => {
    useHotkeys("mod+b", create, { enabled, enableOnFormTags: true, preventDefault: true }, [create, enabled])
}

export default useCreateHotkey
