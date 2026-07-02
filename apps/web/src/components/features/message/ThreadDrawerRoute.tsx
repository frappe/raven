import { useCallback } from "react"
import { useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useFrappeGetDoc } from "frappe-react-sdk"
import ThreadDrawer from "./ThreadDrawer"
import { focusComposer } from "@components/features/ChatInput/composerFocus"
import type { Message } from "@raven/types/common/Message"

/**
 * Router glue for ThreadDrawer, used as the element for `:id/thread/:threadID` (channel + DM)
 * and `/threads/:threadID`. It reads the route param + outlet context (the parent channel,
 * provided by ChatContentView's useOutlet / the Threads page) and builds an `onClose` that
 * routes back to the parent (`..` → the channel/DM, or /threads) and refocuses the parent
 * composer. ThreadDrawer itself stays router-agnostic (pure props), so it can also be hosted
 * directly — e.g. in a notifications panel — without a route.
 */
export default function ThreadDrawerRoute() {
    const { threadID } = useParams<{ threadID: string }>()
    const { parentChannelID: ctxParent } = useOutletContext<{ parentChannelID?: string }>()
    const navigate = useNavigate()

    // The channel/DM views pass the parent via context; the threads page passes it via nav
    // state on click. On a COLD threads-page deep-link there's neither — so resolve it from the
    // thread's root message (Raven Message id = threadID; its channel_id IS the parent channel).
    // This reuses the SAME doctype/name/key ThreadRootMessage fetches on a deep-link, so SWR
    // dedupes it to ONE request; skipped entirely (null key) when context already has the parent.
    const needsResolve = !ctxParent && !!threadID
    const { data: rootMessage } = useFrappeGetDoc<Message>(
        "Raven Message",
        needsResolve ? threadID : "",
        needsResolve ? `raven_message:${threadID}` : null,
    )
    const parentChannelID = ctxParent ?? rootMessage?.channel_id

    const onClose = useCallback(() => {
        navigate("..", { replace: true })
        // Refocus the parent channel's composer (no-op when there's none, e.g. the threads page).
        if (parentChannelID) focusComposer(parentChannelID)
    }, [navigate, parentChannelID])

    if (!threadID) return null
    return <ThreadDrawer threadID={threadID} parentChannelID={parentChannelID} onClose={onClose} />
}
