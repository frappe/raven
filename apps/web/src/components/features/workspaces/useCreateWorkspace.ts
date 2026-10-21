import { useFrappeCreateDoc, useFrappeFileUpload, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import type { RavenWorkspace } from "@raven/types/Raven/RavenWorkspace"
import { useRenameWorkspace } from "./useRenameWorkspace"

/** Extends the generated type with the field that exists in the DocType but is not yet in the TS definition. */
export type WorkspaceFormData = RavenWorkspace & {
    only_admins_can_create_channels?: 0 | 1
}

/**
 * Creates or updates a workspace. A logo file given on create is attached afterwards: the
 * upload needs the saved record to attach to. Refreshes the workspace and channel lists
 * once the workspace is saved, even if the logo upload then fails.
 */
export const useCreateWorkspace = () => {
    const { mutate } = useSWRConfig()
    const { createDoc, loading: creating, error } = useFrappeCreateDoc<WorkspaceFormData>()
    const { updateDoc, loading: updating, error: updateError } = useFrappeUpdateDoc()
    const { renameWorkspace, loading: renaming, error: renameError } = useRenameWorkspace()
    const { upload, loading: uploading, error: uploadError } = useFrappeFileUpload()

    // Awaitable: callers that open the new workspace need it in the list first.
    const refreshLists = () => Promise.all([mutate("workspaces_list"), mutate("channel_list")]).catch(() => { })

    const attachLogo = (workspace: string, logo: File) =>
        upload(logo, {
            doctype: "Raven Workspace",
            docname: workspace,
            fieldname: "logo",
            otherData: { optimize: "1" },
            isPrivate: false,
        }).then((file) => updateDoc("Raven Workspace", workspace, { logo: file.file_url }))

    const createWorkspace = (data: Partial<WorkspaceFormData>, logo?: File) =>
        // The rest of the fields take their DocType defaults.
        createDoc("Raven Workspace", data as WorkspaceFormData).then((workspace) => {
            if (!logo) return refreshLists().then(() => workspace)
            return attachLogo(workspace.name, logo)
                .then(() => workspace)
                .finally(refreshLists)
        })

    /**
     * Resolves to the workspace's name after the save, which a rename changes. `onRenamed`
     * hears the new name as soon as the rename lands, even if the rest of the save then fails.
     */
    const updateWorkspace = (name: string, { workspace_name, ...data }: Partial<WorkspaceFormData>, onRenamed?: (name: string) => void) =>
        (workspace_name && workspace_name !== name ? renameWorkspace(name, workspace_name) : Promise.resolve(name))
            .then((current) => {
                if (current !== name) onRenamed?.(current)
                return updateDoc("Raven Workspace", current, data).then(() => current)
            })
            .finally(refreshLists)

    return {
        createWorkspace,
        updateWorkspace,
        loading: creating || uploading || updating || renaming,
        error: error ?? updateError ?? renameError,
        uploadError,
    }
}
