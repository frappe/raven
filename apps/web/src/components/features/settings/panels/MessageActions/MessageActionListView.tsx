import { useMemo } from "react"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { PlusIcon, ZapIcon } from "lucide-react"
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
import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import _ from "@lib/translate"

/** Shared SWR key for the message-actions list — mutated by the create/detail sub-views. */
export const MESSAGE_ACTIONS_LIST_KEY = "message_actions_list_settings"

type Props = { onCreate: () => void; onOpen: (id: string) => void }

/** Message Actions list — a table with edit/delete row actions + a create action. */
export default function MessageActionListView({ onCreate, onOpen }: Props) {
    const isRavenAdmin = isRavenSettingsAdmin()

    const { data, error, isLoading, mutate } = useFrappeGetDocList<RavenMessageAction>(
        "Raven Message Action",
        { fields: ["name", "enabled", "action_name", "action"], orderBy: { field: "modified", order: "desc" } },
        MESSAGE_ACTIONS_LIST_KEY,
        // Remounts on return from create/detail — refetch then (see cross-panel note).
        { errorRetryCount: 2, revalidateOnMount: true },
    )

    useFrappeDocTypeEventListener("Raven Message Action", () => { mutate() })

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
                <Badge variant={row.original.enabled ? "subtle" : "outline"}>
                    {row.original.enabled ? _("Enabled") : _("Disabled")}
                </Badge>
            ),
        },
    ], [])

    const showEmpty = !isLoading && data?.length === 0

    return (
        <>
            <SettingsPanelHeader
                actions={<Button size="sm" disabled={!isRavenAdmin} onClick={onCreate}><PlusIcon />{_("Create")}</Button>}
            >
                <SettingsPanelTitle>{_("Message Actions")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Use these to add custom actions - like creating an issue/task from a message.")}
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
                        emptyState={<span className="text-ink-gray-4">{_("No message actions found.")}</span>}
                    />
                )}
                {showEmpty && (
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
                        {isRavenAdmin && (
                            <EmptyContent>
                                <Button variant="outline" size="sm" onClick={onCreate}>{_("Create your first action")}</Button>
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </SettingsPanelContent>
        </>
    )
}
