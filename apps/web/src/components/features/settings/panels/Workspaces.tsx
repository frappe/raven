import { Building2Icon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Workspace → Workspaces. TODO: create/manage workspaces and their members. */
export const Workspaces = () => (
    <PlaceholderPanel
        title={_("Workspaces")}
        description={_("Workspaces allow you to organize your channels and teams.")}
        icon={Building2Icon}
        emptyDescription={_("Create workspaces to organize your channels and teams, and manage who can access them.")}
    />
)

export default Workspaces
