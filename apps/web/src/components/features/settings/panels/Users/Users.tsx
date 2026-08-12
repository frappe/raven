import { useMemo, useSyncExternalStore } from "react"
import { UsersIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@components/ui/badge"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { usersStore } from "@stores/usersStore"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import type { UserData } from "@db"
import AddUserDialog from "./AddUserDialog"

/** Workspace → Users: everyone with access to Raven (bots excluded). */
export const Users = () => {
    const usersMap = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)

    const humanUsers = useMemo(
        () =>
            Array.from(usersMap.values())
                .filter((user) => user.type === "User")
                .sort((a, b) => (a.full_name || a.name).localeCompare(b.full_name || b.name)),
        [usersMap],
    )

    return (
        <>
            <SettingsPanelHeader actions={hasRole("System Manager") ? <AddUserDialog /> : null}>
                <SettingsPanelTitle>{_("Users")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Manage users added to Raven.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0">
                <ListView
                    className="flex-1 min-h-0"
                    scrollAreaClassName="flex-1"
                    maxHeight="100%"
                    data={humanUsers}
                    columns={userColumns}
                    getRowId={(row) => row.name}
                    rowHeight={44}
                    emptyState={
                        <Empty>
                            <EmptyMedia>
                                <UsersIcon />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_("No users found")}</EmptyTitle>
                                <EmptyDescription>{_("Users added to Raven will show up here.")}</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                />
            </SettingsPanelContent>
        </>
    )
}

const userColumns: ColumnDef<UserData>[] = [
    {
        id: "full_name",
        accessorKey: "full_name",
        header: _("Name"),
        meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
                <UserAvatar user={row.original} size="sm" showStatusIndicator={false} />
                <span className="font-medium truncate">{row.original.full_name}</span>
                {!row.original.enabled && <Badge variant="outline">{_("Disabled")}</Badge>}
            </div>
        ),
    },
    {
        id: "email",
        accessorKey: "name",
        header: _("Email"),
        meta: { gridWidth: "minmax(180px,2fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) => <span className="text-ink-gray-5">{row.original.name}</span>,
    },
    {
        id: "custom_status",
        accessorKey: "custom_status",
        header: _("Status"),
        meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
        // A status is free text and routinely outruns this column. Badge is `w-fit` with
        // `overflow-clip`, so on its own it grows past the cell and is cut mid-word with no
        // ellipsis. max-w-full caps `fit-content` at the cell — a shrink factor does nothing
        // here, since the ListView cell is a block, not a flex container — and the inner
        // span carries the ellipsis, which the badge's own inline-flex box can't render.
        cell: ({ row }) =>
            row.original.custom_status ? (
                <Badge variant="subtle" className="max-w-full">
                    <span className="truncate">{row.original.custom_status}</span>
                </Badge>
            ) : null,
    },
]

export default Users
