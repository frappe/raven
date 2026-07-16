import { FileTextIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → Instructions. TODO: list + create instruction templates. */
export const Instructions = () => (
    <PlaceholderPanel
        title={_("Instructions")}
        description={_("Save commonly used instructions as templates for your bots.")}
        icon={FileTextIcon}
        emptyTitle={_("AI Instruction Templates")}
        emptyDescription={
            <>
                {_("Most bots require the same kind of instructions to perform their tasks, like \"format dates as DD-MM-YYYY\".")}
                <br />
                {_("Save commonly used instructions as templates for your AI bots.")}
            </>
        }
    />
)

export default Instructions
