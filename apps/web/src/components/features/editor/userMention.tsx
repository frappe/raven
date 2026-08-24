import Mention from "@tiptap/extension-mention"
import type { UserData } from "@db"
import { usersStore } from "@stores/usersStore"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { createMentionSuggestion } from "./createSuggestion"
import { userMentionPluginKey } from "./suggestion"

const MAX_SUGGESTIONS = 20

/**
 * Match enabled users by display/user name. You can mention ANYONE on Raven, not
 * just channel members, so this searches the whole user list (usersStore snapshot —
 * synchronous, already in memory). Empty query returns the first N alphabetically;
 * otherwise name-contains, prefix matches first.
 */
const getUserSuggestions = (query: string): UserData[] => {
    const q = query.toLowerCase().trim()
    const users = [...usersStore.getSnapshot().values()].filter((user) => user.enabled !== 0)
    const matched = q
        ? users.filter((user) => (user.full_name || user.name || "").toLowerCase().includes(q))
        : users
    matched.sort((a, b) => {
        const an = (a.full_name || a.name || "").toLowerCase()
        const bn = (b.full_name || b.name || "").toLowerCase()
        const aStarts = an.startsWith(q) ? 0 : 1
        const bStarts = bn.startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return an.localeCompare(bn)
    })
    return matched.slice(0, MAX_SUGGESTIONS)
}

/**
 * @-mention of a user. Renders exactly the markup the backend parses
 * (`extract_mentions` → `span[data-type="userMention"]` + `data-id`) and the
 * MessageMention renderer hydrates — so a composed mention round-trips to a stored,
 * notified, interactive mention.
 */
export const UserMention = Mention.extend({ name: "userMention" }).configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
    renderHTML: ({ node }) => [
        "span",
        {
            class: "mention",
            "data-type": "userMention",
            "data-id": node.attrs.id,
            "data-label": node.attrs.label ?? node.attrs.id,
        },
        `@${node.attrs.label ?? node.attrs.id}`,
    ],
    suggestion: createMentionSuggestion<UserData>({
        char: "@",
        pluginKey: userMentionPluginKey,
        nodeName: "userMention",
        getItems: getUserSuggestions,
        toAttrs: (user) => ({ id: user.name, label: user.full_name || user.name }),
        getKey: (user) => user.name,
        renderItem: (user) => (
            <>
                <UserAvatar user={user} size="xs" />
                <span className="truncate">{user.full_name || user.name}</span>
            </>
        ),
    }),
})
