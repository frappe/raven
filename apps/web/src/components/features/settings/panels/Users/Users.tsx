import { useCallback, useDeferredValue, useMemo, useState, useSyncExternalStore } from "react"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { CircleCheckIcon, CircleOffIcon, EllipsisVertical, KeyRoundIcon, SearchIcon, UsersIcon } from "lucide-react"
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
import { Button } from "@components/ui/button"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Input } from "@components/ui/input"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { usersStore } from "@stores/usersStore"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { errorResponseToast } from "@components/ui/error-banner"
import { hasRole } from "@lib/permissions"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"
import type { UserData } from "@db"
import AddUserDialog from "./AddUserDialog"
import ManageAccessDialog from "./ManageAccessDialog"
import DisableUserDialog from "./DisableUserDialog"

/** Workspace → Users: everyone with access to Raven (bots excluded). */
export const Users = () => {
    const usersMap = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)
    const { name: currentUser } = useUserCookieData()
    // Inviting, enabling and disabling write the Frappe User, which needs System Manager.
    // Managing access only needs a Raven admin.
    const canEditAccounts = hasRole("System Manager")
    const canManageAccess = isRavenSettingsAdmin()

    // One dialog per action for the whole list. The user stays set while it closes so the
    // exit animation has content.
    const [accessUser, setAccessUser] = useState<UserData | null>(null)
    const [accessOpen, setAccessOpen] = useState(false)
    const openAccess = useCallback((user: UserData) => { setAccessUser(user); setAccessOpen(true) }, [])

    const [disableUser, setDisableUser] = useState<UserData | null>(null)
    const [disableOpen, setDisableOpen] = useState(false)
    const openDisable = useCallback((user: UserData) => { setDisableUser(user); setDisableOpen(true) }, [])

    // Enabling needs no confirmation. The row refreshes from the realtime event.
    // A Raven User is disabled by a disabled account OR a removed Raven User
    // role, so the endpoint restores both, not just the account flag.
    const { call: enableUser } = useFrappePostCall("raven.api.raven_users.enable_user")
    const enable = useCallback((user: UserData) => {
        enableUser({ user: user.name })
            .then(() => toast.success(_("{0} has been enabled", [user.full_name || user.name])))
            .catch((error) => errorResponseToast(_("Could not enable user"), error))
    }, [enableUser])

    const columns = useMemo<ColumnDef<UserData>[]>(() => {
        if (!canManageAccess) return userColumns()
        const actions: RowActions = {
            onManageAccess: openAccess,
            // You can't disable yourself: that would log you out mid-click.
            onEnable: canEditAccounts ? enable : undefined,
            onDisable: canEditAccounts ? openDisable : undefined,
            currentUser,
        }
        return [...userColumns(), actionsColumn(actions)]
    }, [canManageAccess, canEditAccounts, openAccess, enable, openDisable, currentUser])
    const [search, setSearch] = useState("")
    // Filtering is in memory. Deferring keeps typing smooth on big user lists.
    const query = useDeferredValue(search.trim().toLowerCase())

    const humanUsers = useMemo(
        () =>
            Array.from(usersMap.values())
                .filter((user) => user.type === "User")
                .sort((a, b) => (a.full_name || a.name).localeCompare(b.full_name || b.name)),
        [usersMap],
    )

    // Match on name or email.
    const visibleUsers = useMemo(
        () => query
            ? humanUsers.filter((user) => user.full_name?.toLowerCase().includes(query) || user.name.toLowerCase().includes(query))
            : humanUsers,
        [humanUsers, query],
    )

    return (
        <>
            <SettingsPanelHeader actions={canEditAccounts ? <AddUserDialog /> : null}>
                <SettingsPanelTitle>{_("Users")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Manage users added to Raven.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-2">
                <div className="relative">
                    <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4" aria-hidden="true" />
                    <Input
                        inputSize="sm"
                        type="search"
                        className="ps-9"
                        placeholder={_("Search by name or email")}
                        aria-label={_("Search users")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <ListView
                    className="flex-1 min-h-0"
                    scrollAreaClassName="flex-1"
                    maxHeight="100%"
                    data={visibleUsers}
                    columns={columns}
                    getRowId={(row) => row.name}
                    rowHeight={44}
                    emptyState={
                        <Empty>
                            <EmptyMedia>
                                <UsersIcon />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_("No users found")}</EmptyTitle>
                                <EmptyDescription>
                                    {query
                                        ? _("No users match your search.")
                                        : _("Users added to Raven will show up here.")}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                />
            </SettingsPanelContent>
            {accessUser && <ManageAccessDialog user={accessUser} open={accessOpen} onOpenChange={setAccessOpen} />}
            {disableUser && <DisableUserDialog user={disableUser} open={disableOpen} onOpenChange={setDisableOpen} />}
        </>
    )
}

const userColumns = (): ColumnDef<UserData>[] => [
    {
        id: "full_name",
        accessorKey: "full_name",
        header: _("Name"),
        meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
                <UserAvatar user={row.original} size="sm" showStatusIndicator={false} />
                <span className="font-medium truncate">{row.original.full_name}</span>
                {!row.original.enabled && <Badge variant="subtle" theme="gray">{_("Disabled")}</Badge>}
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

type RowActions = {
    onManageAccess: (user: UserData) => void
    /** Account actions are only given to System Managers. */
    onEnable?: (user: UserData) => void
    onDisable?: (user: UserData) => void
    currentUser: string
}

/** Enable or Disable item for one row, below a separator. Nothing on your own row. */
const AccountMenuItem = ({ user, actions }: { user: UserData; actions: RowActions }) => {
    const { onEnable, onDisable, currentUser } = actions
    if (!onEnable || !onDisable || user.name === currentUser) return null
    return (
        <>
            <DropdownMenuSeparator />
            {user.enabled ? (
                <DropdownMenuItem variant="destructive" onClick={() => onDisable(user)}>
                    <CircleOffIcon />
                    {_("Disable")}
                </DropdownMenuItem>
            ) : (
                <DropdownMenuItem onClick={() => onEnable(user)}>
                    <CircleCheckIcon />
                    {_("Enable")}
                </DropdownMenuItem>
            )}
        </>
    )
}

/** Kebab menu on a user row. Only admins see this column. */
const actionsColumn = (actions: RowActions): ColumnDef<UserData> => ({
    id: "actions",
    header: "",
    meta: { gridWidth: "48px" } satisfies ListViewColumnMeta,
    cell: ({ row }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("User actions")}>
                    <EllipsisVertical />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => actions.onManageAccess(row.original)}>
                    <KeyRoundIcon />
                    {_("Manage access")}
                </DropdownMenuItem>
                <AccountMenuItem user={row.original} actions={actions} />
            </DropdownMenuContent>
        </DropdownMenu>
    ),
})

export default Users