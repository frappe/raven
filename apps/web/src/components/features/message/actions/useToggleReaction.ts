import { useCallback, useContext } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { toast } from "sonner"
import { channelMessagesStore } from "@stores/messages/store"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { getErrorMessage } from "@lib/frappe"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { errorResponseToast } from "@components/ui/error-banner"

/** The server's reaction blob shape (calculate_message_reaction), keyed by emoji / emoji_name. */
type ReactionEntry = { reaction: string; users: string[]; count: number; is_custom?: boolean }
type ReactionMap = Record<string, ReactionEntry>

/**
 * Toggle `user` on `key` within the blob, returning a NEW blob in the same shape the
 * backend stores. Adds when absent, removes when present (dropping the key once empty).
 * Touches ONLY this user + key, so it composes safely over reactions from others.
 */
const toggleReactionBlob = (
    raw: string | null | undefined,
    key: string,
    user: string,
    reaction: string,
    isCustom: boolean,
): ReactionMap => {
    let map: ReactionMap = {}
    if (raw) {
        try {
            map = JSON.parse(raw) as ReactionMap
        } catch {
            map = {}
        }
    }
    const entry = map[key]
    if (entry?.users.includes(user)) {
        const users = entry.users.filter((u) => u !== user)
        if (users.length === 0) {
            const next = { ...map }
            delete next[key]
            return next
        }
        return { ...map, [key]: { ...entry, users, count: users.length } }
    }
    if (entry) {
        const users = [...entry.users, user]
        return { ...map, [key]: { ...entry, users, count: users.length } }
    }
    return { ...map, [key]: { reaction, users: [user], count: 1, is_custom: isCustom } }
}

/**
 * Optimistically toggle a reaction on a message — shared by the reaction pills and the
 * hover toolbar. Reads the freshest blob from the store (not a possibly-stale render
 * prop), patches it, then calls the toggle API. On failure it re-toggles to undo — a
 * perfect inverse, since each step flips only this user on this key, so it never clobbers
 * reactions that arrived meanwhile. On success the realtime `message_reacted` echo
 * replaces the blob with server truth (idempotent).
 *
 * `reaction` is the native emoji char, or for a custom emoji its image URL; `emojiName`
 * is the custom emoji's name (which is the blob key for customs).
 */
export const useToggleReaction = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { name: currentUser } = useUserCookieData()

    return useCallback(
        (message: Message, reaction: string, isCustom = false, emojiName?: string) => {
            const channelID = message.channel_id
            const messageID = message.name
            const key = isCustom ? emojiName ?? reaction : reaction

            const apply = () => {
                const current = channelMessagesStore.getState(channelID).byId.get(messageID)?.message_reactions
                const next = toggleReactionBlob(current, key, currentUser, reaction, isCustom)
                channelMessagesStore.reactionsUpdated(channelID, messageID, JSON.stringify(next))
            }

            apply() // optimistic
            call
                .post("raven.api.reactions.react", {
                    message_id: messageID,
                    reaction,
                    is_custom: isCustom,
                    emoji_name: emojiName,
                })
                .catch((e) => {
                    apply() // undo — re-toggling is the exact inverse
                    errorResponseToast(_("Could not update reaction"), e)
                })
        },
        [call, currentUser],
    )
}
