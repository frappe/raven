import { FunctionSquareIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → Functions. TODO: list + create functions for AI agents. */
export const Functions = () => (
    <PlaceholderPanel
        title={_("Functions")}
        description={_("Declare functions to be used by your AI bots.")}
        icon={FunctionSquareIcon}
        emptyTitle={_("Bots + Functions = AI Magic")}
        emptyDescription={_("Use the no-code builder to create functions that allow AI bots to perform actions within the system when requested, like creating documents, or fetching reports to analyze.")}
    />
)

export default Functions
