import { CpuIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** AI → Document Processors. TODO: list + create document processors. */
export const DocumentProcessors = () => (
    <PlaceholderPanel
        title={_("Document Processors")}
        description={_("Create and manage document processors for your bots.")}
        icon={CpuIcon}
        emptyTitle={_("Document Processors")}
        emptyDescription={_("View your active document processors or select a processor type and create a new processor.")}
    />
)

export default DocumentProcessors
