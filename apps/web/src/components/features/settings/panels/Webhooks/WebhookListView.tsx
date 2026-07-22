import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { PlusIcon, WebhookIcon } from "lucide-react"
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
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import { getDateObject } from "@lib/date"
import { isSystemManager } from "@utils/roles"
import _ from "@lib/translate"

/** Shared SWR key for the webhooks list — mutated by the create/detail sub-views. */
export const WEBHOOKS_LIST_KEY = "webhooks_list_settings"

type Props = { onCreate: () => void; onOpen: (webhookID: string) => void }

/** Webhooks list — a table with edit/delete row actions, plus a create action. */
export default function WebhookListView({ onCreate, onOpen }: Props) {
    const isRavenAdmin = isSystemManager()

    const { data, error, isLoading, mutate } = useFrappeGetDocList<RavenWebhook>(
        "Raven Webhook",
        { fields: ["name", "request_url", "enabled", "owner", "creation"] },
        isRavenAdmin ? WEBHOOKS_LIST_KEY : null,
        // Remounts on return from create/detail — refetch then (see cross-panel note).
        { errorRetryCount: 2, revalidateOnMount: true },
    )

    useFrappeDocTypeEventListener("Raven Webhook", () => { mutate() })

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
                <Badge variant={row.original.enabled ? "subtle" : "outline"}>
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

    const showEmpty = !isLoading && (data?.length === 0 || !isRavenAdmin)

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button size="sm" disabled={!isRavenAdmin} onClick={onCreate}>
                        <PlusIcon />
                        {_("Create")}
                    </Button>
                }
            >
                <SettingsPanelTitle>{_("Webhooks")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Fire webhooks on specific events like when a message is sent or channel is created.")}
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
                        emptyState={<span className="text-ink-gray-4">{_("No webhooks found.")}</span>}
                    />
                )}
                {showEmpty && (
                    <Empty className="h-full">
                        <EmptyHeader>
                            <EmptyMedia><WebhookIcon /></EmptyMedia>
                            <EmptyTitle>{_("Webhooks")}</EmptyTitle>
                            <EmptyDescription>
                                {_("Webhooks allow you to receive HTTP requests whenever a specific event occurs - like when a message is sent or a channel is created.")}
                            </EmptyDescription>
                        </EmptyHeader>
                        {isRavenAdmin && (
                            <EmptyContent>
                                <Button variant="outline" size="sm" onClick={onCreate}>{_("Create your first webhook")}</Button>
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </SettingsPanelContent>
        </>
    )
}

