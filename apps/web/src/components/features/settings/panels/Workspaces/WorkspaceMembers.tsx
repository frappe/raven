import { useMemo, useState, useSyncExternalStore } from "react"
import { useFrappeDeleteDoc, useFrappeGetCall, useFrappePostCall, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { CrownIcon, EllipsisVertical, PlusIcon, UserMinusIcon, UsersIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import type { ColumnDef } from "@tanstack/react-table"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { AddMembersStep } from "@components/features/channel/CreateChannel/AddMembersStep"
import { usersStore } from "@stores/usersStore"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { getDateObject } from "@lib/date"
import type { RavenWorkspaceMember } from "@raven/types/Raven/RavenWorkspaceMember"
import type { UserData } from "@db"
import type { FrappeError } from "frappe-react-sdk"
import _ from "@lib/translate"

type WorkspaceMemberFields = Pick<RavenWorkspaceMember, "user" | "is_admin" | "creation" | "name">

const useFetchWorkspaceMembers = (workspaceID: string) =>
    useFrappeGetCall<{ message: WorkspaceMemberFields[] }>(
        "raven.api.workspaces.fetch_workspace_members",
        { workspace: workspaceID },
        ["workspace_members", workspaceID],
        { revalidateOnFocus: false, errorRetryCount: 2 },
    )

/** Members tab: table of workspace members with add / remove / admin-toggle. */
const WorkspaceMembers = ({ workspaceID }: { workspaceID: string }) => {
    const { data, isLoading, error, mutate } = useFetchWorkspaceMembers(workspaceID)
    const { myProfile } = useCurrentRavenUser()
    const usersMap = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)

    const isAdmin = useMemo(
        () => data?.message.some((member) => member.user === myProfile?.name && member.is_admin) ?? false,
        [data, myProfile?.name],
    )

    const existingMemberIds = useMemo(() => data?.message.map((member) => member.user) ?? [], [data])

    const columns = useMemo<ColumnDef<WorkspaceMemberFields>[]>(() => {
        const cols: ColumnDef<WorkspaceMemberFields>[] = [
            {
                id: "user",
                accessorKey: "user",
                header: _("Name"),
                meta: {
                    gridWidth: "minmax(200px,2fr)",
                    getTooltipText: (row) => {
                        const member = row as WorkspaceMemberFields
                        return usersMap.get(member.user)?.full_name ?? member.user
                    },
                } satisfies ListViewColumnMeta,
                cell: ({ row }) => {
                    const user = usersMap.get(row.original.user)
                    return (
                        <div className="flex items-center gap-2 min-w-0">
                            {user && <UserAvatar user={user} size="sm" showStatusIndicator={false} />}
                            <span className="font-medium truncate">{user?.full_name ?? row.original.user}</span>
                            {row.original.is_admin ? (
                                <Badge variant="subtle" className="shrink-0">{_("Admin")}</Badge>
                            ) : null}
                        </div>
                    )
                },
            },
            {
                id: "creation",
                accessorKey: "creation",
                header: _("Joined"),
                meta: { gridWidth: "minmax(140px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span>{getDateObject(row.original.creation).format("Do MMMM YYYY")}</span>,
            },
        ]
        if (isAdmin) {
            cols.push({
                id: "actions",
                header: "",
                size: 50,
                enableResizing: false,
                meta: { truncate: false, truncateTooltip: false } satisfies ListViewColumnMeta,
                cell: ({ row }) => <MemberActions member={row.original} workspaceID={workspaceID} />,
            })
        }
        return cols
    }, [usersMap, isAdmin, workspaceID])

    return (
        <div className="flex flex-col gap-3 h-full min-h-0">
            {isAdmin && (
                <div className="flex justify-end">
                    <AddWorkspaceMembersDialog
                        workspaceID={workspaceID}
                        existingMemberIds={existingMemberIds}
                        onAdded={() => mutate()}
                    />
                </div>
            )}
            {error && <ErrorBanner error={error} />}
            {isLoading && !error && (
                <div className="flex flex-1 items-center justify-center">
                    <Spinner />
                </div>
            )}
            {!isLoading && !error && (
                <ListView
                    className="flex-1 min-h-0"
                    scrollAreaClassName="flex-1"
                    maxHeight="100%"
                    data={data?.message ?? []}
                    columns={columns}
                    getRowId={(row) => row.name}
                    rowHeight={44}
                    emptyState={
                        <Empty>
                            <EmptyMedia>
                                <UsersIcon />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_("No members found")}</EmptyTitle>
                                <EmptyDescription>{_("Members of this workspace will show up here.")}</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                />
            )}
        </div>
    )
}

const MemberActions = ({ member, workspaceID }: { member: WorkspaceMemberFields; workspaceID: string }) => {
    const { mutate } = useSWRConfig()
    const { updateDoc } = useFrappeUpdateDoc()
    const { deleteDoc } = useFrappeDeleteDoc()

    const onUpdate = () => mutate(["workspace_members", workspaceID])

    const toggleAdmin = () => {
        updateDoc("Raven Workspace Member", member.name, { is_admin: !member.is_admin ? 1 : 0 })
            .then(() => {
                toast.success(member.is_admin ? _("Admin removed") : _("Admin added"))
                onUpdate()
            })
            .catch((error) => errorResponseToast(_("Could not update member"), error as FrappeError))
    }

    const removeMember = () => {
        deleteDoc("Raven Workspace Member", member.name)
            .then(() => {
                toast.success(_("Member removed"))
                onUpdate()
            })
            .catch((error) => errorResponseToast(_("Could not remove member"), error as FrappeError))
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" isIconButton aria-label={_("Member options")}>
                    <EllipsisVertical />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-36">
                <DropdownMenuItem onClick={toggleAdmin}>
                    <CrownIcon />
                    {member.is_admin ? _("Remove Admin") : _("Make Admin")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={removeMember}>
                    <UserMinusIcon />
                    {_("Remove Member")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const AddWorkspaceMembersDialog = ({
    workspaceID, existingMemberIds, onAdded,
}: { workspaceID: string; existingMemberIds: string[]; onAdded: () => void }) => {
    const [open, setOpen] = useState(false)
    const [selectedUsers, setSelectedUsers] = useState<UserData[]>([])
    const { call: addMembers, loading, error, reset } = useFrappePostCall("raven.api.workspaces.add_workspace_members")

    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) {
            setSelectedUsers([])
            reset()
        }
    }

    const onSubmit = () => {
        // Send a real array — the endpoint type-checks `members: list` and rejects a JSON string.
        addMembers({ workspace: workspaceID, members: selectedUsers.map((user) => user.name) })
            .then(() => {
                toast.success(_("Members added"))
                onAdded()
                setOpen(false)
            })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <PlusIcon />
                    {_("Add Members")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{_("Add Members")}</DialogTitle>
                    <DialogDescription>{_("Add members to your workspace.")}</DialogDescription>
                </DialogHeader>
                {error && <ErrorBanner error={error} />}
                {/* Fixed height like AddChannelMembers — the picker's virtuoso list
                    needs a computable height; flex-1 inside a content-sized dialog
                    resolves to 0. */}
                <div className="flex h-[24rem] min-h-0 flex-col gap-3">
                    <AddMembersStep
                        selectedUsers={selectedUsers}
                        onSelectUsers={setSelectedUsers}
                        excludeUserIds={existingMemberIds}
                        emptyText={_("Everyone is already a member of this workspace.")}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={loading}>{_("Cancel")}</Button>
                    </DialogClose>
                    <Button size="md" type="button" onClick={onSubmit} disabled={selectedUsers.length === 0 || loading}>
                        {loading && <Spinner />}
                        {_("Add {0} members", [String(selectedUsers.length)])}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default WorkspaceMembers
