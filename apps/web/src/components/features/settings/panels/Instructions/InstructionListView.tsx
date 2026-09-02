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
import { FileTextIcon, SparklesIcon } from "lucide-react"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import type { RavenBotInstructionTemplate } from "@raven/types/RavenAI/RavenBotInstructionTemplate"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

export const INSTRUCTIONS_LIST_KEY = "raven-instruction-templates"

/** AI → Instructions: list of saved instruction templates. Non-admins only see the empty state. */
const InstructionListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(INSTRUCTIONS_LIST_KEY, "Raven Bot Instruction Template", isAdmin)

    const { data, error } = useFrappeGetDocList<RavenBotInstructionTemplate>(
        "Raven Bot Instruction Template",
        {
            fields: ["name", "template_name", "dynamic_instructions", "instruction"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    const columns = useMemo<ColumnDef<RavenBotInstructionTemplate>[]>(
        () => [
            {
                id: "name",
                accessorKey: "template_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <TemplateNameCell template={row.original} onOpen={onOpen} />,
            },
            {
                id: "description",
                accessorKey: "instruction",
                header: _("Description"),
                meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="truncate text-ink-gray-4">{row.original.instruction}</span>,
            },
        ],
        [onOpen],
    )

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Instruction Templates")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Save commonly used instructions as templates for your bots.")}</SettingsPanelDescription>
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
                                    <FileTextIcon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("AI Instruction Templates")}</EmptyTitle>
                                    <EmptyDescription>
                                        {_("Most bots require the same kind of instructions to perform their tasks, like \"format dates as DD-MM-YYYY\" or \"the current user is ")}
                                        <code>{"{{user}}"}</code>
                                        {_("\".")}
                                        <br />
                                        {_("Save commonly used instructions as templates for your AI bots.")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                {isAdmin && (
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first template")}</Button>
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

/** Name column: template name + Dynamic badge, always opening the detail view. */
function TemplateNameCell({ template, onOpen }: { template: RavenBotInstructionTemplate; onOpen: (id: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(template.name)}
            className="group text-left min-w-0 cursor-pointer"
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate group-hover:underline underline-offset-4">{template.template_name}</span>
                {template.dynamic_instructions ? (
                    <Badge variant="subtle" theme="violet">
                        <SparklesIcon /> {_("Dynamic")}
                    </Badge>
                ) : null}
            </div>
        </button>
    )
}

export default InstructionListView
