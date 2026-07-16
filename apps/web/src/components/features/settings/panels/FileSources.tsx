import { FolderIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → File Sources. TODO: upload/manage AI file sources. */
export const FileSources = () => (
    <PlaceholderPanel
        title={_("File Sources")}
        description={_("Add files that can be used by AI Agents.")}
        icon={FolderIcon}
        emptyTitle={_("File Sources")}
        emptyDescription={
            <>
                {_("AI Agents can use files as data sources to get more context, read instructions and execute tasks.")}
                <br />
                {_("You can upload files here and use them across multiple agents.")}
            </>
        }
    />
)

export default FileSources
