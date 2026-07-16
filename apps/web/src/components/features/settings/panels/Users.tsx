import { UsersIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Workspace → Users. TODO: list + manage the people who have access to Raven. */
export const Users = () => (
    <PlaceholderPanel
        title={_("Users")}
        description={_("Manage users added to Raven.")}
        icon={UsersIcon}
        emptyDescription={_("Manage the people who have access to Raven — add users and set their roles.")}
    />
)

export default Users
