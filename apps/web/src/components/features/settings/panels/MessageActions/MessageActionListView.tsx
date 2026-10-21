import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { ZapIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import { SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle } from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import { TablePagination } from "@components/ui/table-pagination"
import usePaginatedList from "@hooks/usePaginatedList"
import useCreateHotkey from "@hooks/useCreateHotkey"
import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"

export const MESSAGE_ACTIONS_LIST_KEY = "raven-message-actions"

/** Integrations → Message Actions: list. Non-admins only see the empty state. */
const MessageActionListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(MESSAGE_ACTIONS_LIST_KEY, "Raven Message Action", isAdmin)
    useCreateHotkey(onCreate, isAdmin)

    const { data, error, mutate } = useFrappeGetDocList<RavenMessageAction>(
        "Raven Message Action",
        {
            fields: ["name", "enabled", "action_name", "action"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    // Another admin's change shows up without a reload.
    useFrappeDocTypeEventListener("Raven Message Action", () => { mutate(); pagination.mutateCount() })

    const columns = useMemo<ColumnDef<RavenMessageAction>[]>(() => [
        {
            id: "action_name",
            accessorKey: "action_name",
            header: _("Name"),
            meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className="font-medium truncate">{row.original.action_name}</span>,
        },
        {
            id: "action",
            accessorKey: "action",
            header: _("Type"),
            meta: { gridWidth: "minmax(0,1fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <Badge variant="subtle">{row.original.action}</Badge>,
        },
        {
            id: "enabled",
            accessorKey: "enabled",
            header: _("Status"),
            meta: { gridWidth: "minmax(0,1fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <Badge variant="subtle" theme={row.original.enabled ? "green" : "gray"}>
                    {row.original.enabled ? _("Enabled") : _("Disabled")}
                </Badge>
            ),
        },
    ], [])

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Message Actions")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Use these to add custom actions - like creating an issue/task from a message.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-2">
                {error && <ErrorBanner error={error} />}
                {!data && !error && (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner />
                    </div>
                )}
                {!!data && !error && (
                    showEmptyState ? (
                        <Empty className="h-full">
                            <EmptyHeader>
                                <EmptyMedia><ZapIcon /></EmptyMedia>
                                <EmptyTitle>{_("Actions")}</EmptyTitle>
                                <EmptyDescription>
                                    {_("Add actions that allow you to create documents or make API calls from the contents of a message - like creating a support ticket or project issue from a message sent in a channel.")}
                                    <br /><br />
                                    {_("Access them by right clicking any message and selecting")} <strong>{_("Actions")}</strong>.
                                </EmptyDescription>
                            </EmptyHeader>
                            {isAdmin && (
                                <EmptyContent>
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first action")}</Button>
                                </EmptyContent>
                            )}
                        </Empty>
                    ) : (
                        <>
                            <ListView
                                className="flex-1 min-h-0"
                                scrollAreaClassName="flex-1"
                                maxHeight="100%"
                                rowHeight={44}
                                data={data}
                                columns={columns}
                                getRowId={(row) => row.name}
                                onRowClick={(row) => onOpen(row.name)}
                            />
                            <TablePagination
                                pageIndex={pagination.pageIndex}
                                pageSize={pagination.pageSize}
                                totalCount={pagination.totalCount}
                                onPageChange={pagination.onPageChange}
                                onPageSizeChange={pagination.onPageSizeChange}
                            />
                        </>
                    )
                )}
            </SettingsPanelContent>
        </>
    )
}

export default MessageActionListView
