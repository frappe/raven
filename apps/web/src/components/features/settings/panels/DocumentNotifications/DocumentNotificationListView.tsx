import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { BellDotIcon, PlusIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import {
    Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@components/ui/empty"
import {
    SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"

/** Shared SWR key for the list — mutated by the create/detail sub-views. */
export const DOC_NOTIFICATIONS_LIST_KEY = "document_notifications_list_settings"

type Props = { onCreate: () => void; onOpen: (id: string) => void }

/** Document Notifications list — a table with edit/delete row actions + a create action. */
export default function DocumentNotificationListView({ onCreate, onOpen }: Props) {
    const isRavenAdmin = isRavenSettingsAdmin()

    const { data, error, isLoading, mutate } = useFrappeGetDocList<RavenDocumentNotification>(
        "Raven Document Notification",
        { fields: ["name", "document_type", "send_alert_on", "enabled"], orderBy: { field: "modified", order: "desc" } },
        isRavenAdmin ? DOC_NOTIFICATIONS_LIST_KEY : null,
        // Remounts on return from create/detail — refetch then (see cross-panel note).
        { errorRetryCount: 2, revalidateOnMount: true },
    )

    useFrappeDocTypeEventListener("Raven Document Notification", () => { mutate() })

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
                <Badge variant={row.original.enabled ? "subtle" : "outline"}>
                    {row.original.enabled ? _("Enabled") : _("Disabled")}
                </Badge>
            ),
        },
    ], [])

    const showEmpty = !isLoading && (data?.length === 0 || !isRavenAdmin)

    return (
        <>
            <SettingsPanelHeader
                actions={<Button size="sm" disabled={!isRavenAdmin} onClick={onCreate}><PlusIcon />{_("Create")}</Button>}
            >
                <SettingsPanelTitle>{_("Document Notifications")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Configure alerts to be sent to users or channels when documents are updated in the system.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0">
                {error && <ErrorBanner error={error} />}
                {isLoading && <div className="flex flex-1 items-center justify-center"><Spinner /></div>}
                {!isLoading && !showEmpty && (
                    <ListView
                        className="flex-1 min-h-0"
                        scrollAreaClassName="flex-1"
                        maxHeight="100%"
                        rowHeight={44}
                        data={data ?? []}
                        columns={columns}
                        getRowId={(row) => row.name}
                        onRowClick={(row) => onOpen(row.name)}
                        emptyState={<span className="text-ink-gray-4">{_("No notifications found.")}</span>}
                    />
                )}
                {showEmpty && (
                    <Empty className="h-full">
                        <EmptyHeader>
                            <EmptyMedia><BellDotIcon /></EmptyMedia>
                            <EmptyTitle>{_("Stay in the Loop")}</EmptyTitle>
                            <EmptyDescription>
                                {_("Send messages to channels or users based on document activity in your ERP system. Keep your team informed about important changes in real-time with rich document previews.")}
                            </EmptyDescription>
                        </EmptyHeader>
                        {isRavenAdmin && (
                            <EmptyContent>
                                <Button variant="outline" size="sm" onClick={onCreate}>{_("Create your first notification")}</Button>
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </SettingsPanelContent>
        </>
    )
}

