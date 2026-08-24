import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useChannelList } from "@stores/channels/useChannelList"
import { usersStore } from "@stores/usersStore"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { PageHeader } from "@components/layout/PageHeader"
import { Input } from "@components/ui/input"
import { loadDraft, saveDraft } from "@components/features/ChatInput/draft"
import { useWorkspaces } from "@hooks/useWorkspaces"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import type { UserData } from "@db"
import _ from "@lib/translate"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"

/** Escape shared plain text before it goes into the (HTML) composer draft. */
const escapeHtml = (raw: string) =>
    raw.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)

/**
 * Web Share Target landing page. The manifest's `share_target` sends OS share-
 * sheet content here as GET params (?title&text&url); the user picks a
 * conversation and the shared content is appended to that channel's DRAFT —
 * the composer restores drafts on mount, so the share arrives ready to edit
 * and send, never sent blind.
 *
 * Support (2026): Chromium only — Android Chrome/Edge/Samsung Internet,
 * ChromeOS, and installed PWAs on Windows. iOS Safari has no share_target, so
 * iPhones can't share INTO the app. GET/text-only by design: receiving FILES
 * requires a POST intercepted by a service worker that controls this page,
 * and ours (scoped to /assets/) deliberately doesn't.
 */
const ShareTarget = () => {
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const { channels, dmChannels } = useChannelList()
    const [query, setQuery] = useState("")

    // Channels store the workspace ID — map to the display name for the rows.
    const { workspaces } = useWorkspaces()
    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.name, workspace.workspace_name])),
        [workspaces],
    )

    const title = params.get("title")?.trim() ?? ""
    const text = params.get("text")?.trim() ?? ""
    const url = params.get("url")?.trim() ?? ""
    // Android apps are inconsistent: many put the link in `text`, some send
    // title = text. Collapse to "one text piece + one url piece", no duplicates.
    const sharedText = text || title
    const sharedUrl = url && !sharedText.includes(url) ? url : ""
    const hasShare = Boolean(sharedText || sharedUrl)

    // Nothing shared (e.g. the page was opened directly) — go home.
    useEffect(() => {
        if (!hasShare) navigate("/", { replace: true })
    }, [hasShare, navigate])

    // Subscribe to the users map: on a cold start at /share-target (how the OS
    // share sheet opens the app), the rows render BEFORE the users load — a
    // bare usersStore.getUser() read would show ids forever.
    const users = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)

    const q = query.trim().toLowerCase()
    const filteredChannels = useMemo(
        () => channels.filter((channel) => !q || channel.channel_name?.toLowerCase().includes(q)),
        [channels, q],
    )
    const filteredDMs = useMemo(
        () =>
            dmChannels.filter((dm) => {
                if (!q) return true
                const peer = users.get(dm.peer_user_id)
                return (peer?.full_name ?? dm.peer_user_id).toLowerCase().includes(q)
            }),
        [dmChannels, q, users],
    )

    const pick = (channel: ChannelListItem) => {
        const pieces: string[] = []
        if (sharedText) pieces.push(escapeHtml(sharedText))
        // An explicit anchor so Tiptap parses it as a real link mark.
        if (sharedUrl) pieces.push(`<a href="${escapeHtml(sharedUrl)}">${escapeHtml(sharedUrl)}</a>`)
        const html = `<p>${pieces.join(" ")}</p>`

        // Append — never clobber a draft the user already has in that channel.
        const existing = loadDraft(channel.name)
        saveDraft(channel.name, existing ? existing + html : html)

        const target = channel.is_direct_message
            ? `/dm-channel/${encodeURIComponent(channel.name)}`
            : `/${encodeURIComponent(channel.workspace ?? "")}/${encodeURIComponent(channel.name)}`
        navigate(target, { replace: true })
    }

    if (!hasShare) return null

    return (
        <div className="flex h-dvh flex-col overflow-hidden">
            <PageHeader title={_("Share to…")} />

            <div className="space-y-2 p-3">
                {/* What's being shared, so the user knows what will land in the draft */}
                <div className="rounded-lg bg-surface-gray-1 px-3 py-2 text-sm text-ink-gray-7">
                    <span className="line-clamp-2 wrap-break-word">{sharedText || sharedUrl}</span>
                    {sharedText && sharedUrl && <span className="line-clamp-1 break-all text-ink-gray-5">{sharedUrl}</span>}
                </div>
                <Input
                    type="search"
                    placeholder={_("Search conversations")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto px-1 pb-8">
                {filteredDMs.length > 0 && (
                    <>
                        <SectionLabel label={_("Direct messages")} />
                        {filteredDMs.map((dm) => (
                            <DMRow key={dm.name} dm={dm} peer={users.get(dm.peer_user_id)} onPick={pick} />
                        ))}
                    </>
                )}
                {filteredChannels.length > 0 && (
                    <>
                        <SectionLabel label={_("Channels")} />
                        {filteredChannels.map((channel) => (
                            <button
                                key={channel.name}
                                type="button"
                                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left active:bg-surface-gray-2"
                                onClick={() => pick(channel)}
                            >
                                <div className="flex items-center gap-2">
                                    <ChannelIcon
                                        type={channel.type}
                                        className="size-4 shrink-0 text-ink-gray-6"
                                    />
                                    <span className="truncate text-base text-ink-gray-8">{channel.channel_name}</span>
                                </div>
                                <div>
                                    {channel.workspace && (
                                        <span className="text-xs text-ink-gray-5">
                                            {workspaceNames.get(channel.workspace) ?? channel.workspace}
                                        </span>
                                    )}
                                </div>

                            </button>
                        ))}
                    </>
                )}
                {filteredChannels.length === 0 && filteredDMs.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-ink-gray-5">{_("No conversations found")}</p>
                )}
            </div>
        </div>
    )
}

const SectionLabel = ({ label }: { label: string }) => (
    <p className="px-3 pb-1 pt-4 text-xs-medium uppercase tracking-wide text-ink-gray-5">{label}</p>
)

// `peer` comes from the parent's reactive users-map subscription — reading the
// store directly here wouldn't re-render when the users finish loading.
const DMRow = ({ dm, peer, onPick }: { dm: DMChannelListItem; peer?: UserData; onPick: (channel: ChannelListItem) => void }) => {
    return (
        <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left active:bg-surface-gray-2"
            onClick={() => onPick(dm)}
        >
            {peer && <UserAvatar user={peer} size="sm" />}
            <span className="truncate text-base text-ink-gray-8">{peer?.full_name ?? dm.peer_user_id}</span>
        </button>
    )
}

export default ShareTarget
