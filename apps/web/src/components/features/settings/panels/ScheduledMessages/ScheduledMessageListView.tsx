import { useMemo } from "react"
import { useAtomValue } from "jotai"
import cronstrue from "cronstrue"
import { useFrappeDocTypeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { CalendarClockIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import { SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle } from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import { TablePagination } from "@components/ui/table-pagination"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { timeFormatAtom } from "@utils/preferences"
import usePaginatedList from "@hooks/usePaginatedList"
import useCreateHotkey from "@hooks/useCreateHotkey"
import type { RavenSchedulerEvent } from "@raven/types/RavenIntegrations/RavenSchedulerEvent"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import ServerScriptsCallout from "./ServerScriptsCallout"
import _ from "@lib/translate"

export const SCHEDULED_MESSAGES_LIST_KEY = "raven-scheduled-messages"

/** The schedule in words, with the raw cron in a tooltip for anyone who wants it. */
const ScheduleCell = ({ expression }: { expression?: string }) => {
    const timeFormat = useAtomValue(timeFormatAtom)
    if (!expression) return <span className="text-ink-gray-5">—</span>
    let words: string
    try {
        words = cronstrue.toString(expression, { use24HourTimeFormat: timeFormat === "24-hour", throwExceptionOnParseError: true })
    } catch {
        // An expression cronstrue cannot read is still shown, just as-is.
        return <span className="truncate font-mono text-p-sm text-ink-gray-7">{expression}</span>
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="truncate text-ink-gray-7">{words}</span>
            </TooltipTrigger>
            <TooltipContent><span className="font-mono">{expression}</span></TooltipContent>
        </Tooltip>
    )
}

/** Integrations → Scheduled Messages: list. Non-admins only see the empty state. */
const ScheduledMessageListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(SCHEDULED_MESSAGES_LIST_KEY, "Raven Scheduler Event", isAdmin)
    useCreateHotkey(onCreate, isAdmin)

    const { data, error, mutate } = useFrappeGetDocList<RavenSchedulerEvent>(
        "Raven Scheduler Event",
        {
            fields: ["name", "event_name", "disabled", "event_frequency", "cron_expression", "bot", "channel"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    useFrappeDocTypeEventListener("Raven Scheduler Event", () => { mutate(); pagination.mutateCount() })

    const columns = useMemo<ColumnDef<RavenSchedulerEvent>[]>(
        () => [
            {
                id: "name",
                accessorKey: "event_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => (
                    <div className="flex min-w-0 items-center gap-2">
                        <button type="button" onClick={() => onOpen(row.original.name)} className="min-w-0 cursor-pointer truncate text-left font-medium hover:underline underline-offset-4">
                            {row.original.event_name}
                        </button>
                        <Badge variant="subtle" theme={row.original.disabled ? "gray" : "green"}>
                            {row.original.disabled ? _("Disabled") : _("Enabled")}
                        </Badge>
                    </div>
                ),
            },
            {
                id: "schedule",
                accessorKey: "cron_expression",
                header: _("Schedule"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <ScheduleCell expression={row.original.cron_expression} />,
            },
            {
                id: "bot",
                accessorKey: "bot",
                header: _("Agent"),
                meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="truncate text-ink-gray-7">{row.original.bot}</span>,
            },
        ],
        [onOpen],
    )

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Scheduled Messages")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("You can create a scheduled message & a bot will send it to you at the specified time.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4">
                <ServerScriptsCallout />
                {error && <ErrorBanner error={error} />}
                {!data && !error && isAdmin && (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner />
                    </div>
                )}
                {(!!data || !isAdmin) && !error && (
                    showEmptyState ? (
                        <Empty>
                            <EmptyMedia>
                                <CalendarClockIcon />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>{_("Scheduled Messages")}</EmptyTitle>
                                <EmptyDescription>
                                    {_("Schedule messages and reminders to be sent to you at a specific date and time.")}
                                    <br />
                                    {_("For example, you could schedule a reminder for a meeting to be sent to a channel every week.")}
                                </EmptyDescription>
                            </EmptyHeader>
                            {isAdmin && (
                                <EmptyContent>
                                    <Button variant="outline" onClick={onCreate}>{_("Schedule a reminder")}</Button>
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
                    )
                )}
            </SettingsPanelContent>
        </>
    )
}

export default ScheduledMessageListView
