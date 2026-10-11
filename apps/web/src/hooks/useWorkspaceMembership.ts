import { useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { getErrorMessage } from "@lib/frappe"
import _ from "@lib/translate"
import type { WorkspaceFields } from "@hooks/useWorkspaces"

/** A workspace anyone can join by themselves: public, not invite-only, and not joined yet. */
export const isJoinable = (workspace: WorkspaceFields) =>
    !workspace.workspace_member_name && workspace.type === "Public" && !workspace.can_only_join_via_invite

type Messages = { loading: string; success: string; error: string }

/**
 * Calls a membership endpoint with a progress toast. Resolves once the workspace and channel
 * lists have refetched, so the caller moves on with lists that already show the change.
 */
const useMembershipCall = (method: string, messages: (name: string) => Messages) => {
    const { call } = useFrappePostCall(method)
    const { mutate } = useSWRConfig()

    return (workspace: WorkspaceFields) => {
        const done = call({ workspace: workspace.name }).then(() =>
            Promise.all([mutate("workspaces_list"), mutate("channel_list")]),
        )
        const text = messages(workspace.workspace_name)
        toast.promise(done, {
            loading: text.loading,
            success: text.success,
            error: (error) => getErrorMessage(error) || text.error,
        })
        return done
    }
}

export const useJoinWorkspace = () =>
    useMembershipCall("raven.api.workspaces.join_workspace", (name) => ({
        loading: _("Joining {0}…", [name]),
        success: _("You joined {0}.", [name]),
        error: _("Could not join {0}.", [name]),
    }))

export const useLeaveWorkspace = () =>
    useMembershipCall("raven.api.workspaces.leave_workspace", (name) => ({
        loading: _("Leaving {0}…", [name]),
        success: _("You left {0}.", [name]),
        error: _("Could not leave {0}.", [name]),
    }))
