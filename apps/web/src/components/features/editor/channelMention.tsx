import Mention from "@tiptap/extension-mention"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { channelStore } from "@stores/channels/store"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { createMentionSuggestion } from "./createSuggestion"
import { channelMentionPluginKey } from "./suggestion"

const MAX_SUGGESTIONS = 20

/**
 * Match non-archived channels by name, from the channel store snapshot (synchronous;
 * `getChannels()` is channels-only, no DMs). Empty query returns the first N
 * alphabetically; otherwise name-contains, prefix matches first.
 */
const getChannelSuggestions = (query: string): ChannelListItem[] => {
    const q = query.toLowerCase().trim()
    const channels = channelStore.getChannels().filter((channel) => channel.is_archived !== 1)
    const matched = q
        ? channels.filter((channel) => (channel.channel_name || channel.name).toLowerCase().includes(q))
        : channels
    matched.sort((a, b) => {
        const an = (a.channel_name || a.name).toLowerCase()
        const bn = (b.channel_name || b.name).toLowerCase()
        const aStarts = an.startsWith(q) ? 0 : 1
        const bStarts = bn.startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return an.localeCompare(bn)
    })
    return matched.slice(0, MAX_SUGGESTIONS)
}

/**
 * #-mention of a channel. Render-only (no backend extraction): renders the markup
 * the MessageMention renderer turns into a navigable channel link
 * (`span[data-type="channelMention"]` + `data-id`).
 */
export const ChannelMention = Mention.extend({ name: "channelMention" }).configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `#${node.attrs.label ?? node.attrs.id}`,
    renderHTML: ({ node }) => [
        "span",
        {
            class: "mention",
            "data-type": "channelMention",
            "data-id": node.attrs.id,
            "data-label": node.attrs.label ?? node.attrs.id,
        },
        `#${node.attrs.label ?? node.attrs.id}`,
    ],
    suggestion: createMentionSuggestion<ChannelListItem>({
        char: "#",
        pluginKey: channelMentionPluginKey,
        nodeName: "channelMention",
        getItems: getChannelSuggestions,
        toAttrs: (channel) => ({ id: channel.name, label: channel.channel_name || channel.name }),
        getKey: (channel) => channel.name,
        renderItem: (channel) => <ChannelSuggestionRow channel={channel} />,
    }),
})

/**
 * Suggestion row: icon + name, workspace DISPLAY name right-aligned.
 * Suggestions span all workspaces, so the workspace disambiguates same-named
 * channels (#general everywhere). A component (not inline JSX in renderItem)
 * because resolving id → workspace_name needs the useWorkspaces hook — its
 * SWR cache is long-lived, so 20 rows cost one cached read each.
 */
const ChannelSuggestionRow = ({ channel }: { channel: ChannelListItem }) => {
    const { workspaces } = useWorkspaces()
    const workspaceName = channel.workspace
        ? workspaces.find((workspace) => workspace.name === channel.workspace)?.workspace_name ?? channel.workspace
        : undefined
    return (
        <>
            <ChannelIcon type={channel.type} className="size-4 shrink-0 text-ink-gray-5" />
            <span className="min-w-0 truncate">{channel.channel_name || channel.name}</span>
            {workspaceName && (
                <span className="ml-auto shrink-0 pl-2 text-sm text-ink-gray-5">{workspaceName}</span>
            )}
        </>
    )
}
