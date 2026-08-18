import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAtom, useAtomValue } from "jotai"
import { ArrowDown, LoaderCircle } from "lucide-react"
import DateSeparator from "./renderers/DateSeparator"
import UnreadSeparator from "./renderers/UnreadSeparator"
import SystemMessage from "./renderers/SystemMessage"
import { MessageItem } from "./renderers/MessageItem"
import { BatchMessageItem } from "./renderers/BatchMessageItem"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { Button } from "@components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@components/ui/empty"
import { useChannelMessages } from "@stores/messages/useChannelMessages"
import { channelMessagesStore } from "@stores/messages/store"
import { claimWindowForTarget, releaseWindowClaim } from "@stores/messages/loaders"
import { useChannelOutbox } from "@stores/messages/useChannelOutbox"
import { useChannelReadTracker } from "@stores/unread/useChannelReadTracker"
import { usePollRealtime } from "@hooks/usePollRealtime"
import { useWindowLinkPreviewPrefetch } from "@stores/linkPreviews/useLinkPreview"
import { useStreamScroll } from "./useStreamScroll"
import { MessageActionMenu } from "./actions/MessageActionMenu"
import { messageTargetAtom, messageActionTargetAtom, messagePressTargetAtom, makeMessageTarget } from "@utils/channelAtoms"
import { ScrollViewportContext } from "@hooks/useHasBeenInView"
import { createDateTracker, DateTrackerContext, FloatingDatePill, type DateOrderEntry } from "./messageDateTracker"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { useIsMobile } from "@hooks/use-mobile"

/** Pill stays for this long after the last scroll event, then fades out. */
const SCROLL_IDLE_MS = 1200

/** How long a navigated-to message stays highlighted. */
const HIGHLIGHT_DURATION_MS = 4000

export type ChatStreamProps = {
    /** Channel, DM channel, or thread id — threads are channels too. */
    channelID: string
    /** Newline-separated pinned message ids (from the channel doc). */
    pinnedMessagesString?: string
    /**
     * Ask the stream to open centered on this message. Used by panes that don't have a
     * ?message_id URL (the notifications/search/saved panes). Passing it here means the
     * very first fetch is already centered on the message — one request instead of a
     * plain "latest messages" fetch racing a second "around the message" fetch.
     */
    initialMessageID?: string | null
    /**
     * Ignore the URL's ?message_id — it belongs to ANOTHER stream on the page. The
     * thread drawer sets this: a channel can be open with a thread beside it, and the
     * URL's message target must only drive the channel's stream, not the thread's
     * (the thread would otherwise try to fetch around a message it doesn't contain).
     */
    disableURLTarget?: boolean
    /**
     * Whether the user can interact with this channel/thread (reply, create thread,
     * pin, swipe-to-reply). Hosts derive it from their composer gate
     * (state === "composer"), which knows membership — including THREAD membership —
     * and archived state. Defaults to true.
     */
    canInteract?: boolean
}

/**
 * The message stream: a windowed, bottom-anchored list of messages.
 *
 * Self-contained and reusable — give it a channel id and it fetches, paginates,
 * and scrolls on its own. Pages compose it next to their own headers, inputs,
 * and drawers (channel page, DM page, thread drawer, threads page).
 */
export default function ChatStream({ channelID, pinnedMessagesString, initialMessageID, disableURLTarget = false, canInteract = true }: ChatStreamProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    // Deep link (?message_id= from shared URLs) or a pane-provided target (notifications
    // page). Passed to the hook so the channel's FIRST fetch is already centered on it.
    const deepLinkMessageID = (disableURLTarget ? null : searchParams.get("message_id")) ?? initialMessageID ?? null

    const {
        blocks,
        isLoading,
        error,
        hasOlderMessages,
        hasNewerMessages,
        loadingOlder,
        loadingNewer,
        loadOlder,
        loadNewer,
        jumpToLatest,
        jumpToMessage,
        firstUnreadMessage,
    } = useChannelMessages(channelID, pinnedMessagesString, deepLinkMessageID)

    // The "scroll to this message" request (see MessageTarget in channelAtoms). All entry
    // points — URL, notification click, reply click — set this same atom.
    const [target, setTarget] = useAtom(messageTargetAtom(channelID))
    const targetMessageID = target?.id ?? null
    const [highlightedID, setHighlightedID] = useState<string | null>(null)
    /** Message the action menu is acting on — highlighted so the user knows the target. */
    const actionTarget = useAtomValue(messageActionTargetAtom)
    // Mobile: the message under a settled touch (pre-long-press feedback) — highlighted
    // exactly like the action target, so the press visibly "grabs" its message.
    const pressTargetID = useAtomValue(messagePressTargetAtom)

    // A URL deep link is just another way to request a jump: turn it into a target.
    // Also claim the window right away (see loaders.ts) so nothing can replace the
    // centered page while we navigate to it.
    useEffect(() => {
        if (deepLinkMessageID) {
            claimWindowForTarget(channelID, deepLinkMessageID)
            setTarget(makeMessageTarget(deepLinkMessageID))
        }
    }, [channelID, deepLinkMessageID])

    // Make sure the target message is actually in the loaded window. If it isn't, fetch
    // the page around it ONCE and wait for the result:
    //  - message found  → done, the scroll engine (below) will center it.
    //  - message absent → it was deleted or the id is wrong; drop the request quietly.
    // The awaited promise is the only thing that decides "give up" — earlier versions
    // guessed from re-render timing and kept abandoning jumps too early.
    useEffect(() => {
        if (!target) return
        claimWindowForTarget(channelID, target.id)
        if (channelMessagesStore.getState(channelID).byId.has(target.id)) return
        let stale = false
        jumpToMessage(target.id).then((found) => {
            // A newer request (or a channel switch) took over while we waited — leave it be.
            if (!stale && !found) setTarget(null)
        })
        return () => {
            stale = true
        }
    }, [target, channelID])

    // Give the window claim back when the user moves to another channel. It intentionally
    // stays claimed after the scroll lands, so late background fetches still can't replace
    // the page the user is reading. "Jump to present" releases it explicitly.
    useEffect(() => {
        return () => releaseWindowClaim(channelID)
    }, [channelID])

    /** The scroll engine centered the target: highlight it and clean up the URL. */
    const onTargetSettled = useCallback(
        (messageID: string) => {
            setTarget(null)
            setHighlightedID(messageID)
            // Only the stream that OWNS the URL target may clean it up.
            if (!disableURLTarget && searchParams.get("message_id") === messageID) {
                const next = new URLSearchParams(searchParams)
                next.delete("message_id")
                setSearchParams(next, { replace: true })
            }
        },
        [searchParams, setSearchParams, setTarget, disableURLTarget],
    )

    useEffect(() => {
        if (!highlightedID) return
        const timer = setTimeout(() => setHighlightedID(null), HIGHLIGHT_DURATION_MS)
        return () => clearTimeout(timer)
    }, [highlightedID])

    const { containerRef, onScroll, isAtBottom, hasUnseenMessages, scrollToBottom } = useStreamScroll({
        channelID,
        blocks,
        loadOlder,
        loadNewer,
        hasOlderMessages,
        hasNewerMessages,
        targetMessageID,
        onTargetSettled,
        hasUnreadDivider: firstUnreadMessage !== null,
    })

    // Expose the scroll container as the in-view root (useHasBeenInView), so messages
    // can lazily fetch their extra data only when visible. State (not the raw ref) so
    // consumers re-render once it's available and root their observers at the container.
    const [viewport, setViewport] = useState<HTMLElement | null>(null)
    useEffect(() => setViewport(containerRef.current), [containerRef])

    // Tracks how far the user has read (the newest in-view message) and flushes
    // that watermark to the server (last_visit), which defines unread counts.
    const { onMessageInView } = useChannelReadTracker(channelID, { isAtBottom, hasNewerMessages })

    // Puts this channel's not-yet-confirmed sends (the saved outbox) back on screen,
    // so pending/failed messages survive a refresh and reappear when you reopen it.
    useChannelOutbox(channelID)

    // Revalidates this channel's polls on a `poll_update` event (vote/retract/close).
    // Scoped to this stream, so background channels' polls aren't refetched.
    usePollRealtime(channelID)

    // Fetch link previews for the whole window as soon as its blocks land —
    // one batched call — so preview cards render WITH their rows instead of
    // popping in mid-scroll and shifting the layout.
    useWindowLinkPreviewPrefetch(blocks)

    /** When the window is detached from the live edge, "down" means refetching the latest page. */
    const onJumpToPresent = () => {
        if (hasNewerMessages) {
            scrollToBottom()
            jumpToLatest()
        } else {
            scrollToBottom("smooth")
        }
    }

    const showJumpButton = !isLoading && !error && (!isAtBottom || hasNewerMessages)

    // Tracks the date currently under the viewport for the floating pill. Held in a per-stream
    // store (not React state) so date crossings + scroll activity re-render only the pill, never
    // the message list. The inline date dividers report their crossings into it.
    const trackerRef = useRef<ReturnType<typeof createDateTracker> | null>(null)
    const tracker = (trackerRef.current ??= createDateTracker())
    const dateOrder = useMemo<DateOrderEntry[]>(
        () =>
            blocks
                .filter((b) => b.message_type === "date")
                .map((b) => ({ name: b.name, label: b.creation })),
        [blocks],
    )
    useEffect(() => tracker.setOrder(dateOrder), [tracker, dateOrder])

    // The conversation's very FIRST date separator drops its line: a full-width
    // rule with nothing above it reads as clutter (right under a thread's root
    // message, or at the top of a channel's history). Only when the real start
    // is loaded — with older history still above, the topmost separator is
    // just a window edge, not "the first".
    const plainDateName = !hasOlderMessages ? dateOrder[0]?.name : undefined

    // The pill shows while scrolling and fades out shortly after the user stops.
    const scrollIdleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const handleScroll = useCallback(() => {
        onScroll()
        tracker.setScrolling(true)
        clearTimeout(scrollIdleTimer.current)
        scrollIdleTimer.current = setTimeout(() => tracker.setScrolling(false), SCROLL_IDLE_MS)
    }, [onScroll, tracker])
    useEffect(() => () => clearTimeout(scrollIdleTimer.current), [])

    const isMobile = useIsMobile()

    return (
        <ScrollViewportContext.Provider value={viewport}>
            <DateTrackerContext.Provider value={tracker}>
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                    <FloatingDatePill />
                    <MessageActionMenu channelID={channelID} canInteract={canInteract}>
                        <div
                            ref={containerRef}
                            onScroll={handleScroll}
                            // Keep the fade very subtle: a small mask only nibbles the very edge. A
                            // container mask unavoidably fades ANY content at the edge (incl. images),
                            // so the smaller the region the less an image visibly dissolves on scroll.
                            className="dark:scroll-fade [--scroll-fade-t-size:2rem] [--scroll-fade-b-size:2rem] flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [overflow-anchor:none]"
                        >
                            <div className="flex min-w-0 w-full flex-col md:px-3 pb-6">
                                {isLoading ? (
                                    <MessageListSkeleton />
                                ) : error ? (
                                    <StreamError error={error} onRetry={jumpToLatest} />
                                ) : blocks.length === 0 ? (
                                    <StreamEmpty />
                                ) : (
                                    <>
                                        {/* Constant-height row while more history exists: the spinner only ever
                                changes pixels, not geometry. Height changes that move content must
                                land atomically with `blocks` changes for scroll compensation to be exact. */}
                                        {hasOlderMessages && (
                                            <div className="flex h-10 shrink-0 items-center justify-center">
                                                {loadingOlder && (
                                                    <LoaderCircle className="h-4 w-4 animate-spin text-ink-gray-5" />
                                                )}
                                            </div>
                                        )}
                                        {/* TODO(perf): wrap MessageItem/BatchMessageItem in React.memo — every
                                            stream-level change (new message, reaction, highlight/press atoms)
                                            re-renders ALL visible rows today. Message objects are identity-
                                            stable (store diff-and-reuse) and onMessageInView is stable, so memo
                                            would collapse that to just the changed rows. Do with profiling. */}
                                        {blocks.map((block) =>
                                            block.message_type === "date" ? (
                                                <DateSeparator label={block.creation} name={block.name} key={block.name} showLine={block.name !== plainDateName} />
                                            ) : block.message_type === "unread" ? (
                                                <UnreadSeparator key={block.name} />
                                            ) : block.message_type === "batch" ? (
                                                <div
                                                    key={block.name}
                                                    data-message-id={block.messages[0].name}
                                                    data-batch-root=""
                                                    // All member ids of this batch, space-separated. Some members have
                                                    // no DOM node of their own (the caption text, images inside a
                                                    // collapsed stack) — when the scroll engine can't find a message
                                                    // by id, it scrolls to the batch that contains it via this attribute.
                                                    data-batch-member={block.messages.map((member) => member.name).join(" ")}
                                                    className={cn(
                                                        // Radius only on desktop — mobile rows are edge-to-edge.
                                                        "flex flex-col md:rounded-md transition-colors duration-700",
                                                        block.messages.some((member) => member.name === highlightedID) &&
                                                        "bg-surface-amber-2 dark:bg-surface-gray-2",
                                                        // Press/action-target highlight: stronger + instant (duration
                                                        // overrides the slow scroll-highlight fade).
                                                        block.messages.some((member) => member.name === actionTarget?.name || member.name === pressTargetID) &&
                                                        "bg-surface-gray-3 duration-100",
                                                    )}
                                                >
                                                    <BatchMessageItem block={block} onInView={onMessageInView} />
                                                </div>
                                            ) : block.message_type === "System" ? (
                                                <SystemMessage
                                                    message={block.text ?? ""}
                                                    data={block.json}
                                                    time={block.creation}
                                                    key={block.name}
                                                />
                                            ) : (
                                                <div
                                                    key={block.render_key ?? block.name}
                                                    data-message-id={block.name}
                                                    // Deliberately NO content-visibility: placeholder estimates change height
                                                    // after paint and break exact scroll compensation on prepend.
                                                    className={cn(
                                                        "flex flex-col md:rounded-md transition-colors duration-700",
                                                        highlightedID === block.name && "bg-surface-amber-2 dark:bg-surface-gray-2",
                                                        // See the batch row above — press + action-target highlight.
                                                        (actionTarget?.name === block.name || pressTargetID === block.name) && "bg-surface-gray-3 duration-100",
                                                    )}
                                                >
                                                    <MessageItem message={block} onInView={onMessageInView} />
                                                </div>
                                            ),
                                        )}
                                        {/* Same constant-height rule as the top row: while the window is
                                detached, this slot exists whether or not a fetch is running. */}
                                        {hasNewerMessages && (
                                            <div className="flex h-10 shrink-0 items-center justify-center">
                                                {loadingNewer && (
                                                    <LoaderCircle className="h-4 w-4 animate-spin text-ink-gray-5" />
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </MessageActionMenu>

                    {showJumpButton && (
                        <div className="absolute bottom-3 right-4 z-50">
                            <Button
                                variant="outline"
                                size={isMobile ? "lg" : "sm"}
                                isIconButton={hasUnseenMessages ? false : true}
                                onClick={onJumpToPresent}
                                className="rounded-full shadow"
                            >
                                <ArrowDown />
                                {/* "New messages" only when one actually arrived while scrolled up.
                            hasNewerMessages just means the window is detached (e.g. scrolled
                            past the 300 cap, or deep-linked) — that's a plain jump-to-present. */}
                                {hasUnseenMessages && (
                                    <span>{_("New messages")}</span>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </DateTrackerContext.Provider>
        </ScrollViewportContext.Provider>
    )
}

const StreamEmpty = () => (
    <Empty>
        <EmptyHeader>
            <EmptyTitle>{_("No messages yet")}</EmptyTitle>
            <EmptyDescription>{_("Start the conversation by sending a message.")}</EmptyDescription>
        </EmptyHeader>
    </Empty>
)

const StreamError = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <Empty>
        <EmptyHeader>
            <EmptyTitle>{_("Could not load messages")}</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={onRetry}>
            {_("Try again")}
        </Button>
    </Empty>
)
