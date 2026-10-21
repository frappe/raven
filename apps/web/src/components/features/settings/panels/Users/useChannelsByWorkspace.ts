import { useMemo } from "react"
import { useChannels } from "@stores/channels/useChannelList"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"

/**
 * Channels an admin can add people to, grouped by workspace id.
 * Only channels the admin is in are known to the client, which is also the set
 * the server lets them add to. DMs, archived and Open channels are skipped;
 * every workspace member is already in the Open ones.
 */
export const useChannelsByWorkspace = () => {
    const { channels } = useChannels()
    return useMemo(() => {
        const map = new Map<string, ChannelListItem[]>()
        for (const c of channels) {
            if (c.is_direct_message || c.is_archived || c.type === "Open" || !c.workspace) continue
            map.set(c.workspace, [...(map.get(c.workspace) ?? []), c])
        }
        // Most recently active first, so the channels worth adding someone to are at the top.
        // Timestamps are "YYYY-MM-DD HH:mm:ss" strings, so plain string order is date order.
        for (const list of map.values()) {
            list.sort((a, b) => (b.last_message_timestamp ?? b.creation ?? "").localeCompare(a.last_message_timestamp ?? a.creation ?? ""))
        }
        return map
    }, [channels])
}

export default useChannelsByWorkspace
