import { useCallback, useContext, useEffect, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener } from "frappe-react-sdk"
import type { Message } from "@raven/types/common/Message"
import type { StreamBlock } from "@stores/messages/types"
import { linkPreviewStore, type LinkPreviewData, type LinkPreviewEntry } from "./store"

/**
 * The stored preview for one link, as the message wrote it (raw url).
 * Registers interest on mount — call it from a component that only mounts
 * once it is (nearly) visible (useHasBeenInView), so a channel full of
 * links costs one batched call per screen, not per message.
 *
 * undefined = still unknown. null = the server has nothing for this url.
 */
export const useLinkPreview = (url?: string): LinkPreviewEntry | undefined => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        if (!url) return
        linkPreviewStore.setClient(call)
        linkPreviewStore.register(url)
    }, [url, call])

    return useSyncExternalStore(
        useCallback((onChange) => (url ? linkPreviewStore.subscribe(url, onChange) : () => {}), [url]),
        () => (url ? linkPreviewStore.get(url) : undefined),
    )
}

/** A message's previewable link — the first one, same rule as the renderer. */
const firstLink = (message: Message): string | undefined => {
    if (message.hide_link_preview) return undefined
    return message.links
        ?.split("\n")
        .map((line) => line.trim())
        .find(Boolean)
}

/**
 * Prefetch previews for the WHOLE loaded window the moment its blocks
 * land (ChatStream calls this). One batched call per window instead of
 * per-visibility fetches — so by the time a row paints, its preview is
 * already in the store and the card renders WITH the row. That is what
 * keeps scrolling smooth: a card that mounts late inserts height
 * mid-scroll, and no amount of correction makes that free.
 */
export const useWindowLinkPreviewPrefetch = (blocks: StreamBlock[]) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        linkPreviewStore.setClient(call)
        for (const block of blocks) {
            if (block.message_type === "date" || block.message_type === "unread") continue
            const messages = block.message_type === "batch" ? block.messages : [block]
            for (const message of messages) {
                const href = firstLink(message)
                if (href) linkPreviewStore.register(href)
            }
        }
    }, [blocks, call])
}

type LinkPreviewsUpdatedEvent = {
    channel_id: string
    previews: LinkPreviewData[]
}

/**
 * App-level wiring for `link_previews_updated` (mount once, next to
 * useMessagesRealtime). The event carries whole previews, so the store
 * patches without a refetch.
 */
export const useLinkPreviewsRealtime = () => {
    useFrappeEventListener("link_previews_updated", (event: LinkPreviewsUpdatedEvent) => {
        if (event?.previews?.length) linkPreviewStore.applyRealtime(event.previews)
    })
}
