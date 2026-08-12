import { KeyboardIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Other → Keyboard Shortcuts. TODO: list the app's keyboard shortcuts. */
export const KeyboardShortcuts = () => (
    <PlaceholderPanel
        title={_("Keyboard Shortcuts")}
        description={_("Speed up your workflow with keyboard shortcuts.")}
        icon={KeyboardIcon}
        emptyDescription={_("A list of keyboard shortcuts is on its way to the new Raven.")}
    />
)

export default KeyboardShortcuts
