import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { BellDotIcon } from "lucide-react"
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
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"

export const DOC_NOTIFICATIONS_LIST_KEY = "raven-document-notifications"

/** Integrations → Document Notifications: list. Non-admins only see the empty state. */
const DocumentNotificationListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(DOC_NOTIFICATIONS_LIST_KEY, "Raven Document Notification", isAdmin)
    useCreateHotkey(onCreate, isAdmin)

    const { data, error, mutate } = useFrappeGetDocList<RavenDocumentNotification>(
        "Raven Document Notification",
        {
            fields: ["name", "document_type", "send_alert_on", "enabled"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    // Another admin's change shows up without a reload.
    useFrappeDocTypeEventListener("Raven Document Notification", () => { mutate(); pagination.mutateCount() })

    const columns = useMemo<ColumnDef<RavenDocumentNotification>[]>(() => [
        {
            id: "name",
            accessorKey: "name",
            header: _("Name"),
            meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className="font-medium truncate">{row.original.name}</span>,
        },
        {
            id: "document_type",
            accessorKey: "document_type",
            header: _("Document Type"),
            meta: { gridWidth: "minmax(0,1.5fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className="text-ink-gray-6 truncate">{row.original.document_type}</span>,
        },
        {
            id: "send_alert_on",
            accessorKey: "send_alert_on",
            header: _("Send Alert On"),
            meta: { gridWidth: "minmax(0,1fr)" } satisfies ListViewColumnMeta,
            cell: ({ row }) => <Badge variant="subtle">{row.original.send_alert_on}</Badge>,
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
                <SettingsPanelTitle>{_("Document Notifications")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Configure alerts to be sent to users or channels when documents are updated in the system.")}
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
                                <EmptyMedia><BellDotIcon /></EmptyMedia>
                                <EmptyTitle>{_("Stay in the Loop")}</EmptyTitle>
                                <EmptyDescription>
                                    {_("Send messages to channels or users based on document activity in your ERP system. Keep your team informed about important changes in real-time with rich document previews.")}
                                </EmptyDescription>
                            </EmptyHeader>
                            {isAdmin && (
                                <EmptyContent>
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first notification")}</Button>
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

export default DocumentNotificationListView
