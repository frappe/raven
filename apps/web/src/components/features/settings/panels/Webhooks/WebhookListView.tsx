import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { WebhookIcon } from "lucide-react"
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
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import { getDateObject } from "@lib/date"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"

export const WEBHOOKS_LIST_KEY = "raven-webhooks"

/** Integrations → Webhooks: list of webhooks. Non-admins only see the empty state. */
const WebhookListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(WEBHOOKS_LIST_KEY, "Raven Webhook", isAdmin)
    useCreateHotkey(onCreate, isAdmin)

    const { data, error, mutate } = useFrappeGetDocList<RavenWebhook>(
        "Raven Webhook",
        {
            fields: ["name", "request_url", "enabled", "owner", "creation"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    // Another admin's change shows up without a reload.
    useFrappeDocTypeEventListener("Raven Webhook", () => { mutate(); pagination.mutateCount() })

    const columns = useMemo<ColumnDef<RavenWebhook>[]>(() => [
        {
            id: "name",
            accessorKey: "name",
            header: _("Name"),
            meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className="font-medium truncate">{row.original.name}</span>,
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
        {
            id: "owner",
            accessorKey: "owner",
            header: _("Created By"),
            meta: { gridWidth: "minmax(0,1.5fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className="text-ink-gray-6 truncate">{row.original.owner}</span>,
        },
        {
            id: "creation",
            accessorKey: "creation",
            header: _("Created On"),
            meta: { gridWidth: "minmax(0,1fr)", tabularNums: true } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span>{getDateObject(row.original.creation).format("MMM Do, YYYY")}</span>,
        },
    ], [])

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Webhooks")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Fire webhooks on specific events like when a message is sent or channel is created.")}
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
                                <EmptyMedia><WebhookIcon /></EmptyMedia>
                                <EmptyTitle>{_("Webhooks")}</EmptyTitle>
                                <EmptyDescription>
                                    {_("Webhooks allow you to receive HTTP requests whenever a specific event occurs - like when a message is sent or a channel is created.")}
                                </EmptyDescription>
                            </EmptyHeader>
                            {isAdmin && (
                                <EmptyContent>
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first webhook")}</Button>
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

export default WebhookListView
