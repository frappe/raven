import { useMemo, useState } from "react"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@components/ui/dialog"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import { useWorkspaces } from "@hooks/useWorkspaces"
import type { UserData } from "@db"
import _ from "@lib/translate"
import WorkspaceAccessPicker from "./WorkspaceAccessPicker"
import useChannelsByWorkspace from "./useChannelsByWorkspace"

type Access = { workspaces: string[]; channels: string[] }

/** Edit which workspaces and channels a user belongs to. Saves only what changed. */
export const ManageAccessDialog = ({
    user, open, onOpenChange,
}: { user: UserData; open: boolean; onOpenChange: (open: boolean) => void }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] top-[10vh] translate-y-0 max-h-[80vh]">
            <DialogHeader>
                <DialogTitle>{_("Manage access")}</DialogTitle>
                <DialogDescription>{user.full_name || user.name}</DialogDescription>
            </DialogHeader>
            {open && <AccessLoader user={user} onClose={() => onOpenChange(false)} />}
        </DialogContent>
    </Dialog>
)

/** Fetches the current memberships, then hands them to the editor as its starting state. */
const AccessLoader = ({ user, onClose }: { user: UserData; onClose: () => void }) => {
    const { data, error, mutate } = useFrappeGetCall<{ message: Access }>(
        "raven.api.raven_users.get_user_access",
        { user: user.name },
        `user-access-${user.name}`,
        { revalidateOnFocus: false },
    )

    if (error) return <ErrorBanner error={error} />
    if (!data) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Spinner />
            </div>
        )
    }
    return <AccessEditor user={user} initial={data.message} onSaved={(next) => { mutate({ message: next }, { revalidate: false }); onClose() }} />
}

const AccessEditor = ({
    user, initial, onSaved,
}: { user: UserData; initial: Access; onSaved: (next: Access) => void }) => {
    const { workspaces } = useWorkspaces()
    const channelsByWorkspace = useChannelsByWorkspace()

    // The picker only knows channels the admin can manage. Start from the user's
    // memberships within that set, so the counts and the diff line up.
    const manageable = useMemo(
        () => new Set([...channelsByWorkspace.values()].flat().map((c) => c.name)),
        [channelsByWorkspace],
    )
    const initialChannels = useMemo(() => initial.channels.filter((c) => manageable.has(c)), [initial.channels, manageable])

    // Removing someone from a channel needs channel-admin rights. Lock the ones the caller cannot change.
    const lockedChannels = useMemo(() => {
        const adminOf = new Set([...channelsByWorkspace.values()].flat().filter((c) => c.is_admin).map((c) => c.name))
        return new Set(initialChannels.filter((c) => !adminOf.has(c)))
    }, [channelsByWorkspace, initialChannels])

    const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>(initial.workspaces)
    const [selectedChannels, setSelectedChannels] = useState<string[]>(initialChannels)

    const diff = useMemo(() => {
        const only = (a: string[], b: string[]) => a.filter((x) => !b.includes(x))
        return {
            add_workspaces: only(selectedWorkspaces, initial.workspaces),
            remove_workspaces: only(initial.workspaces, selectedWorkspaces),
            add_channels: only(selectedChannels, initialChannels),
            remove_channels: only(initialChannels, selectedChannels),
        }
    }, [selectedWorkspaces, selectedChannels, initial.workspaces, initialChannels])
    const hasChanges = Object.values(diff).some((list) => list.length > 0)

    const { call, loading, error } = useFrappePostCall<{ message: Access }>("raven.api.raven_users.update_user_access")

    const save = () => {
        call({ user: user.name, ...diff }).then((res) => {
            toast.success(_("Access updated"))
            onSaved(res.message)
        }).catch(() => { /* shown by the error banner */ })
    }

    return (
        <>
            <DialogBody className="flex flex-col gap-4">
                {error && <ErrorBanner error={error} />}
                <WorkspaceAccessPicker
                    workspaces={workspaces}
                    channelsByWorkspace={channelsByWorkspace}
                    selectedWorkspaces={selectedWorkspaces}
                    onWorkspacesChange={setSelectedWorkspaces}
                    selectedChannels={selectedChannels}
                    onChannelsChange={setSelectedChannels}
                    lockedChannels={lockedChannels}
                    disabled={loading}
                />
            </DialogBody>
            <DialogFooter>
                <DialogClose asChild>
                    <Button size="md" type="button" variant="outline" disabled={loading}>{_("Cancel")}</Button>
                </DialogClose>
                <Button size="md" type="button" onClick={save} disabled={!hasChanges} loading={loading} loadingText={_("Saving")}>
                    {_("Save")}
                </Button>
            </DialogFooter>
        </>
    )
}

export default ManageAccessDialog
