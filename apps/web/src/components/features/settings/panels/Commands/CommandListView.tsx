import { useMemo } from "react"
import { useFrappeGetDocList } from "frappe-react-sdk"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { Kbd } from "@components/ui/kbd"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import { CheckIcon, WandSparklesIcon } from "lucide-react"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import type { RavenBotAIPrompt } from "@raven/types/RavenAI/RavenBotAIPrompt"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")

/** AI → Commands: list of saved prompts. Non-admins only see the empty state. */
const CommandListView = ({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()

    const { data, isLoading, error } = useFrappeGetDocList<RavenBotAIPrompt>(
        "Raven Bot AI Prompt",
        {
            fields: ["name", "prompt", "raven_bot", "is_global"],
            orderBy: { field: "modified", order: "desc" },
        },
        isAdmin ? "raven-saved-prompts" : null,
        { errorRetryCount: 2 },
    )

    const columns = useMemo<ColumnDef<RavenBotAIPrompt>[]>(
        () => [
            {
                id: "prompt",
                accessorKey: "prompt",
                header: _("Prompt"),
                meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <PromptCell prompt={row.original.prompt} name={row.original.name} onOpen={onOpen} />,
            },
            {
                id: "raven_bot",
                accessorKey: "raven_bot",
                header: _("Agent"),
                meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => <span className="font-normal truncate text-ink-gray-4">{row.original.raven_bot}</span>,
            },
            {
                id: "is_global",
                accessorKey: "is_global",
                header: _("Is Global"),
                meta: { gridWidth: "minmax(90px,0.5fr)" } satisfies ListViewColumnMeta,
                cell: ({ row }) => (row.original.is_global === 1 ? <CheckIcon className="size-3.5 text-ink-gray-6" /> : null),
            },
        ],
        [onOpen],
    )

    const showEmptyState = !data || data.length === 0 || !isAdmin

    return (
        <>
            <SettingsPanelHeader actions={isAdmin ? <Button size="sm" onClick={onCreate}>{_("Create")}</Button> : null}>
                <SettingsPanelTitle>{_("Saved Commands")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Save commonly used commands and prompts for your AI bots and access them via \"/\" in chat.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4">
                {error && <ErrorBanner error={error} />}
                {isLoading && !error && (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner />
                    </div>
                )}
                {!isLoading && !error && (
                    <>
                        {!showEmptyState && <AINotEnabledCallout />}
                        {showEmptyState ? (
                            <Empty className="relative">
                                <div className="absolute inset-x-0 top-0">
                                    <AINotEnabledCallout />
                                </div>
                                <EmptyMedia>
                                    <WandSparklesIcon />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_("Who's going to type all that?")}</EmptyTitle>
                                    <EmptyDescription>
                                        {_("Often we ask our AI assistants for the same thing.")}
                                        <br />
                                        {_("Save commonly used commands here and insert them in your message by either clicking the")}{" "}
                                        <WandSparklesIcon className="inline-flex align-[-0.15em] size-3.5" />
                                        {" "}{_("button or using")}{" "}
                                        <Kbd>{isMac ? "⌘" : "Ctrl"} + ⇧ + K</Kbd>
                                        {"."}
                                    </EmptyDescription>
                                </EmptyHeader>
                                {isAdmin && (
                                    <Button variant="outline" onClick={onCreate}>{_("Create your first command")}</Button>
                                )}
                            </Empty>
                        ) : (
                            <ListView
                                className="flex-1 min-h-0"
                                scrollAreaClassName="flex-1"
                                maxHeight="100%"
                                rowHeight={44}
                                data={data}
                                columns={columns}
                                getRowId={(row) => row.name}
                            />
                        )}
                    </>
                )}
            </SettingsPanelContent>
        </>
    )
}

/** Prompt column: truncated text button opening the detail view. */
function PromptCell({ prompt, name, onOpen }: { prompt: string; name: string; onOpen: (id: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(name)}
            className="hover:underline underline-offset-4 text-left min-w-0 cursor-pointer"
        >
            <span className="font-medium truncate block">{prompt}</span>
        </button>
    )
}

export default CommandListView
