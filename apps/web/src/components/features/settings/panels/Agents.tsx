import { BotIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → Agents. TODO: list + create AI agents. */
export const Agents = () => (
    <PlaceholderPanel
        title={_("Agents")}
        description={_("Use agents to send reminders, run AI assistants, and more.")}
        icon={BotIcon}
        emptyTitle={_("Get started with agents")}
        emptyDescription={
            <>
                {_("Create agents to run automations on Raven.")}
                <br />
                {_("Send reminders, document notifications and run AI assistants.")}
            </>
        }
    />
)

export default Agents
