import { useHotkeys } from "react-hotkeys-hook"

/** mod+S submits the surrounding settings form — parity with v2's create/edit pages. */
export const useSaveHotkey = (save: () => void) => {
    useHotkeys("mod+s", save, { enableOnFormTags: true, preventDefault: true })
}

export default useSaveHotkey
