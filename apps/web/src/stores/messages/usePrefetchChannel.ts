import { useCallback, useContext, useEffect, useRef } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { prefetchChannel, type FrappeCallClient } from "./loaders"

// Hover-intent delay: only prefetch once the cursor has settled, so flicking the mouse down the
// list doesn't fire a request per row it lands on. Channels with unread messages are far likelier
// to be opened, so they warm on a short settle; caught-up channels need a longer, deliberate
// pause (you're usually just scanning past them).
const HOVER_INTENT_UNREAD_MS = 120
const HOVER_INTENT_READ_MS = 350

// Scrolling a list under a stationary cursor fires pointerenter on every row that passes by, so
// prefetch is suppressed while a sidebar list is scrolling. The sidebars set this from Virtuoso's
// `isScrolling` (see setChannelListScrolling). Module-level: only one list scrolls at a time.
let listScrolling = false
export const setChannelListScrolling = (scrolling: boolean) => {
    listScrolling = scrolling
}

/**
 * Returns pointer handlers that warm a channel's first message page on hover-intent — spread
 * onto a sidebar row (`<NavLink {...usePrefetchChannel(channel.name)} … />`). prefetchChannel
 * no-ops for already-warm channels, so this only helps cold ones (first visit / evicted past
 * the warm window). Suppressed while the list is scrolling (rows passing under the cursor).
 * Pass `hasUnread` so likely-to-be-opened channels warm on a shorter hover.
 */
export function usePrefetchChannel(channelID: string, hasUnread = false) {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const delay = hasUnread ? HOVER_INTENT_UNREAD_MS : HOVER_INTENT_READ_MS

    const onPointerEnter = useCallback(() => {
        if (listScrolling) return
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            // Re-check: a scroll may have started during the intent delay.
            if (!listScrolling) prefetchChannel(call as FrappeCallClient, channelID)
        }, delay)
    }, [call, channelID, delay])

    const onPointerLeave = useCallback(() => clearTimeout(timer.current), [])

    // Rows are virtualized — cancel a pending prefetch if the row recycles mid-hover.
    useEffect(() => () => clearTimeout(timer.current), [])

    return { onPointerEnter, onPointerLeave }
}
