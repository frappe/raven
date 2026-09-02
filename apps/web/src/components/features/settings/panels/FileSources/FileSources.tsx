import { useMemo, useState } from "react"
import { useFrappeDeleteDoc, useFrappeGetDocList, useSWRConfig } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
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
import { FileIcon, Trash2Icon } from "lucide-react"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import { getTimePassed } from "@raven/lib/utils/dateConversions"
import type { RavenAIFileSource } from "@raven/types/RavenAI/RavenAIFileSource"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import FileSourceUploadDialog from "./FileSourceUploadDialog"
import _ from "@lib/translate"

const FILE_SOURCES_KEY = "raven-ai-file-sources"

/** AI → File Sources: files uploaded for AI Agents to use as data sources. */
export const FileSources = () => {
    const { mutate: globalMutate } = useSWRConfig()
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(FILE_SOURCES_KEY, "Raven AI File Source", isAdmin)

    const { data, error } = useFrappeGetDocList<RavenAIFileSource>(
        "Raven AI File Source",
        {
            fields: ["name", "file_name", "file", "file_type", "creation"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    const [selected, setSelected] = useState<RavenAIFileSource | null>(null)
    const { deleteDoc, loading: deleteLoading, error: deleteError } = useFrappeDeleteDoc()

    const invalidateList = () => globalMutate((key) => typeof key === "string" && key.startsWith(FILE_SOURCES_KEY))

    const onDelete = () => {
        if (!selected) return
        deleteDoc("Raven AI File Source", selected.name).then(async () => {
            await invalidateList()
            setSelected(null)
        }).catch(() => { /* surfaced by the error banner */ })
    }

    const refresh = async () => {
        await invalidateList()
    }

    const columns = useMemo<ColumnDef<RavenAIFileSource>[]>(
        () => [
            {
                id: "file_name",
                accessorKey: "file_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => (
                    <a
                        href={row.original.file}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline underline-offset-4 truncate"
                    >
                        {row.original.file_name}
                    </a>
                ),
            },
            {
                id: "file_type",
                accessorKey: "file_type",
                header: _("Type"),
                meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => (
                    <Badge variant="subtle" theme="gray" className="uppercase">
                        {row.original.file_type}
                    </Badge>
                ),
            },
            {
                id: "creation",
                accessorKey: "creation",
                header: _("Uploaded"),
                meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="text-ink-gray-4">{getTimePassed(row.original.creation)}</span>,
            },
            {
                id: "actions",
                header: "",
                size: 50,
                enableSorting: false,
                enableResizing: false,
                meta: { truncate: false, truncateTooltip: false } satisfies ListViewColumnMeta,
                cell: ({ row }) => (
                    <Button
                        type="button"
                        variant="ghost"
                        theme="red"
                        isIconButton
                        aria-label={_("Delete")}
                        title={_("Delete")}
                        onClick={() => setSelected(row.original)}
                    >
                        <Trash2Icon />
                    </Button>
                ),
            },
        ],
        [],
    )

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader
                actions={
                    isAdmin ? <FileSourceUploadDialog onUpload={refresh} /> : null
                }
            >
                <SettingsPanelTitle>{_("File Sources")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Add files that can be used by AI Agents.")}</SettingsPanelDescription>
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
                                    <FileIcon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("File Sources")}</EmptyTitle>
                                    <EmptyDescription>
                                        {_("AI Agents can use files as data sources to get more context, read instructions and execute tasks.")}
                                        <br />
                                        {_("You can upload files here and use them across multiple agents.")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                {isAdmin && (
                                    <FileSourceUploadDialog
                                        trigger={
                                            <Button type="button" variant="outline" size="sm">
                                                {_("Upload a file")}
                                            </Button>
                                        }
                                        onUpload={refresh}
                                    />
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

            <AlertDialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{_("Delete File?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {_("Are you sure you want to delete the file")} <strong>{selected?.file_name}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && <ErrorBanner error={deleteError} />}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>{_("Cancel")}</AlertDialogCancel>
                        <Button variant="solid" theme="red" disabled={deleteLoading} onClick={onDelete}>
                            {deleteLoading && <Spinner />}
                            {deleteLoading ? _("Deleting...") : _("Delete")}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default FileSources
