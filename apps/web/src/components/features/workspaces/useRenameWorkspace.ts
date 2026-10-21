import { useAtom } from "jotai"
import { useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import { lastWorkspaceAtom } from "@utils/lastVisitedAtoms"

/**
 * Renames a workspace. Its name is its workspace_name, so this is a document rename, which
 * also carries the new name into every channel's `workspace` link server-side. Both lists
 * refetch, or the renamed workspace's sidebar shows no channels until a later revalidation.
 */
export const useRenameWorkspace = () => {
    const { mutate } = useSWRConfig()
    const [lastWorkspace, setLastWorkspace] = useAtom(lastWorkspaceAtom)
    const { call, loading, error } = useFrappePostCall<{ message: string }>("frappe.model.rename_doc.update_document_title")

    /** Resolves to the workspace's new name. */
    const renameWorkspace = (name: string, newName: string) =>
        call({ doctype: "Raven Workspace", docname: name, name: newName, merge: 0 }).then(({ message }) => {
            if (lastWorkspace === name) setLastWorkspace(message)
            mutate("workspaces_list")
            mutate("channel_list")
            return message
        })

    return { renameWorkspace, loading, error }
}
