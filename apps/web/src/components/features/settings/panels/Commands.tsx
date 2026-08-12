import { CommandIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → Commands. TODO: list + create saved commands/prompts. */
export const Commands = () => (
    <PlaceholderPanel
        title={_("Commands")}
        description={_("Save commonly used commands and prompts for your AI bots and access them via \"/\" in chat.")}
        icon={CommandIcon}
        emptyTitle={_("Who's going to type all that?")}
        emptyDescription={
            <>
                {_("Often we ask our AI assistants for the same thing.")}
                <br />
                {_("Save commonly used commands here and insert them in your message via \"/\" in chat.")}
            </>
        }
    />
)

export default Commands
