import { useMemo } from "react"
import WorkspaceActions from "@components/features/workspaces/WorkspaceActions"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Badge } from "@components/ui/badge"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import type { ColumnDef } from "@tanstack/react-table"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import { useWorkspaces, WorkspaceFields } from "@hooks/useWorkspaces"
import { Building2Icon, Globe, Lock } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import _ from "@lib/translate"
import CreateWorkspaceButton from "./AddWorkspaceDialog"

export default function WorkspaceListView({ onOpenWorkspace }: { onOpenWorkspace: (workspaceID: string) => void }) {
    const { workspaces, isLoading, error } = useWorkspaces()

    const workspaceColumns = useMemo<ColumnDef<WorkspaceFields>[]>(
        () => [
            {
                id: "name",
                accessorKey: "workspace_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <WorkspaceNameCell workspace={row.original} onOpenWorkspace={onOpenWorkspace} />,
            },
            {
                id: "type",
                accessorKey: "type",
                header: _("Type"),
                meta: { gridWidth: "minmax(110px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <WorkspaceTypeCell type={row.original.type} />,
            },
            {
                id: "membership",
                accessorKey: "workspace_member_name",
                header: _("Membership"),
                meta: { gridWidth: "minmax(130px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <MembershipCell workspace={row.original} />,
            },
            {
                id: "description",
                accessorKey: "description",
                header: _("Description"),
                meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="text-ink-gray-4">{row.original.description}</span>,
            },
            {
                id: "actions",
                header: "",
                size: 50,
                enableResizing: false,
                meta: { truncate: false, truncateTooltip: false } satisfies ListViewColumnMeta,
                cell: ({ row }) => <WorkspaceActions workspace={row.original} onManage={onOpenWorkspace} />,
            },
        ],
        [onOpenWorkspace],
    )

    return (
        <>
            <SettingsPanelHeader actions={<CreateWorkspaceButton onCreated={onOpenWorkspace} />}>
                <SettingsPanelTitle>{_("Workspaces")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Workspaces allow you to organize your channels and teams.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0">
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
                        rowHeight={44}
                        data={workspaces ?? []}
                        columns={workspaceColumns}
                        getRowId={(row) => row.name}
                        emptyState={
                            <Empty>
                                <EmptyMedia>
                                    <Building2Icon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("No workspaces found")}</EmptyTitle>
                                    <EmptyDescription>{_("Workspaces you can access will show up here.")}</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    />
                )}
            </SettingsPanelContent>
        </>
    )
}

/**
 * Name column: logo + name, always opening the detail view. Non-admins get the same
 * link — the detail view renders read-only for them rather than being unreachable.
 */
function WorkspaceNameCell({
    workspace,
    onOpenWorkspace,
}: {
    workspace: WorkspaceFields
    onOpenWorkspace: (workspaceID: string) => void
}) {
    const content = (
        <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-8 w-8 rounded-md border border-outline-gray-2">
                <AvatarImage src={workspace.logo} alt={workspace.workspace_name} />
                <AvatarFallback className="rounded-md">
                    {workspace.workspace_name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="font-medium truncate">{workspace.workspace_name}</span>
        </div>
    )

    return (
        <button
            type="button"
            onClick={() => onOpenWorkspace(workspace.name)}
            className="hover:underline underline-offset-4 text-left min-w-0 cursor-pointer"
        >
            {content}
        </button>
    )
}

/**
 * Type column: Shows badge with icon indicating Public/Private.
 */
function WorkspaceTypeCell({ type }: { type: WorkspaceFields["type"] }) {
    const isPrivate = type === "Private"

    return (
        <Badge variant={isPrivate ? "subtle" : "outline"}>
            {isPrivate ? (
                <Lock className="mr-1 h-3 w-3" />
            ) : (
                <Globe className="mr-1 h-3 w-3" />
            )}
            {type && _(type)}
        </Badge>
    )
}

/**
 * Membership column: Shows user's role in the workspace.
 */
function MembershipCell({ workspace }: { workspace: WorkspaceFields }) {
    if (workspace.is_admin) {
        return <Badge variant="solid">{_("Admin")}</Badge>
    }
    if (workspace.workspace_member_name) {
        return <Badge variant="subtle">{_("Member")}</Badge>
    }
    return <Badge variant="outline">{_("Not a member")}</Badge>
}
