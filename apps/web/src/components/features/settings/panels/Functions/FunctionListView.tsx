import { useMemo } from "react"
import { useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import { TablePagination } from "@components/ui/table-pagination"
import usePaginatedList from "@hooks/usePaginatedList"
import { CheckIcon, SquareFunctionIcon } from "lucide-react"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

export const FUNCTIONS_LIST_KEY = "raven-ai-functions"

/** AI → Functions: list of declared functions. Non-admins only see the empty state. */
const FunctionListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(FUNCTIONS_LIST_KEY, "Raven AI Function", isAdmin)

    const { data, error } = useFrappeGetDocList<RavenAIFunction>(
        "Raven AI Function",
        {
            fields: ["name", "description", "function_name", "type", "requires_write_permissions"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    const columns = useMemo<ColumnDef<RavenAIFunction>[]>(
        () => [
            {
                id: "function_name",
                accessorKey: "function_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <FunctionNameCell func={row.original} onOpen={onOpen} />,
            },
            {
                id: "description",
                accessorKey: "description",
                header: _("Description"),
                meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="truncate text-ink-gray-4">{row.original.description}</span>,
            },
            {
                id: "type",
                accessorKey: "type",
                header: _("Type"),
                meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <Badge variant="outline" theme="gray">{row.original.type}</Badge>,
            },
            {
                id: "requires_write_permissions",
                accessorKey: "requires_write_permissions",
                header: _("Writes"),
                meta: { gridWidth: "minmax(60px,0.4fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) =>
                    row.original.requires_write_permissions === 1 ? <CheckIcon className="size-3.5 text-ink-gray-6" /> : null,
            },
        ],
        [onOpen],
    )

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Functions")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Declare functions to be used by your AI bots.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4">
                {error && <ErrorBanner error={error} />}
                {!data && !error && (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner />
                    </div>
                )}
                {!!data && !error && (
                    <>
                        {!showEmptyState && <AINotEnabledCallout />}
                        {showEmptyState ? (
                            <Empty className="relative">
                                <div className="absolute inset-x-0 top-0">
                                    <AINotEnabledCallout />
                                </div>
                                <EmptyMedia>
                                    <SquareFunctionIcon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("Bots + Functions = AI Magic")}</EmptyTitle>
                                    <EmptyDescription>
                                        {_("Use the no-code builder to create functions that allow AI bots to perform actions within the system when requested, like creating documents, or fetching reports to analyze.")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                {isAdmin && (
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first function")}</Button>
                                )}
                            </Empty>
                        ) : (
                            <>
                                <ListView
                                    className="flex-1 min-h-0"
                                    scrollAreaClassName="flex-1"
                                    maxHeight="100%"
                                    rowHeight={44}
                                    data={data ?? []}
                                    columns={columns}
                                    getRowId={(row) => row.name}
                                />
                                <TablePagination
                                    pageIndex={pagination.pageIndex}
                                    pageSize={pagination.pageSize}
                                    totalCount={pagination.totalCount}
                                    onPageChange={pagination.onPageChange}
                                    onPageSizeChange={pagination.onPageSizeChange}
                                />
                            </>
                        )}
                    </>
                )}
            </SettingsPanelContent>
        </>
    )
}

/** Name column: function name button opening the detail view. */
function FunctionNameCell({ func, onOpen }: { func: RavenAIFunction; onOpen: (id: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(func.name)}
            className="hover:underline underline-offset-4 text-left min-w-0 cursor-pointer"
        >
            <span className="font-medium truncate block">{func.function_name}</span>
        </button>
    )
}

export default FunctionListView
