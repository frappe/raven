import { SmilePlusIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Workspace → Emojis. TODO: upload/manage custom emojis. */
export const Emojis = () => (
    <PlaceholderPanel
        title={_("Emojis")}
        description={_("Add custom emojis to use for your reactions. PNG, SVG and GIFs supported.")}
        icon={SmilePlusIcon}
        emptyDescription={
            <>
                {_("Personalize your chats with custom emojis.")}
                <br />
                {_("Upload your own or download from")}{" "}
                <a href="https://emoji.gg" target="_blank" rel="noopener noreferrer">Emoji.gg</a>.
            </>
        }
    />
)

export default Emojis
