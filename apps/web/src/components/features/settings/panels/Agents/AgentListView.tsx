import { useMemo } from "react"
import { useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card"
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
import { BotIcon, CircleCheckIcon, CircleXIcon, SparklesIcon } from "lucide-react"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import _ from "@lib/translate"

export const AGENTS_LIST_KEY = "raven-bots"

/** AI → Agents: list of bots. Non-admins only see the empty state. */
const AgentListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()
    const pagination = usePaginatedList(AGENTS_LIST_KEY, "Raven Bot", isAdmin)

    const { data, error } = useFrappeGetDocList<RavenBot>(
        "Raven Bot",
        {
            fields: ["name", "bot_name", "is_ai_bot", "description", "image", "enable_file_search", "dynamic_instructions", "instruction", "allow_bot_to_write_documents", "enable_code_interpreter"],
            orderBy: { field: "modified", order: "desc" },
            ...pagination.listArgs,
        },
        pagination.swrKey,
        { errorRetryCount: 2, keepPreviousData: true },
    )

    const columns = useMemo<ColumnDef<RavenBot>[]>(
        () => [
            {
                id: "name",
                accessorKey: "bot_name",
                header: _("Name"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <AgentNameCell bot={row.original} onOpen={onOpen} />,
            },
            {
                id: "description",
                accessorKey: "description",
                header: _("Description"),
                meta: { gridWidth: "minmax(0,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => (
                    <span className="truncate text-ink-gray-4">
                        {row.original.description || row.original.instruction}
                    </span>
                ),
            },
        ],
        [onOpen],
    )

    const showEmptyState = !isAdmin || ((data?.length ?? 0) === 0 && pagination.totalCount === 0)

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Agents")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Use agents to send reminders, run AI assistants, and more.")}</SettingsPanelDescription>
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
                        {showEmptyState ? (
                            <Empty>
                                <EmptyMedia>
                                    <BotIcon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("Get started with agents")}</EmptyTitle>
                                    <EmptyDescription>
                                        {_("Create agents to run automations on Raven.")}
                                        <br />
                                        {_("Send reminders, document notifications and run AI assistants.")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                {isAdmin && (
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first agent")}</Button>
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

/** Name column: avatar + bot name button → detail, with an AI badge hover card. */
function AgentNameCell({ bot, onOpen }: { bot: RavenBot; onOpen: (id: string) => void }) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <button
                type="button"
                onClick={() => onOpen(bot.name)}
                className="group text-left min-w-0 cursor-pointer"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8 rounded-md">
                        <AvatarImage src={bot.image} alt={bot.bot_name} />
                        <AvatarFallback className="rounded-md">
                            {bot.bot_name.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate group-hover:underline underline-offset-4">{bot.bot_name}</span>
                </div>
            </button>
            {bot.is_ai_bot ? <AIFeaturesBadge bot={bot} /> : null}
        </div>
    )
}

/** Hover card badge listing the bot's enabled AI features. */
function AIFeaturesBadge({ bot }: { bot: RavenBot }) {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Badge variant="subtle" theme="violet">
                    <SparklesIcon /> {_("AI")}
                </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-60">
                <div className="flex flex-col gap-2">
                    <BotFeatureRow enabled={bot.allow_bot_to_write_documents} label={_("Can Write Documents")} />
                    <BotFeatureRow enabled={bot.enable_file_search} label={_("File Search")} />
                    <BotFeatureRow enabled={bot.enable_code_interpreter} label={_("Code Interpreter")} />
                    <BotFeatureRow enabled={bot.dynamic_instructions} label={_("Dynamic Instructions")} />
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

/** One row of the AI features hover card: green check / red cross + label. */
function BotFeatureRow({ enabled, label }: { enabled?: 0 | 1; label: string }) {
    return (
        <div className="flex items-center gap-2">
            {enabled
                ? <CircleCheckIcon className="text-ink-green-8" />
                : <CircleXIcon className="text-ink-red-8" />}
            <span className="text-sm text-ink-gray-8">{label}</span>
        </div>
    )
}

export default AgentListView
