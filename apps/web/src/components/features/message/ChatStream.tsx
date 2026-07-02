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
import { useChannelOutbox } from "@stores/messages/useChannelOutbox"
import { useChannelReadTracker } from "@stores/unread/useChannelReadTracker"
import { usePollRealtime } from "@hooks/usePollRealtime"
import { useStreamScroll } from "./useStreamScroll"
import { MessageActionMenu } from "./actions/MessageActionMenu"
import { MessageActionDialogs } from "./actions/MessageActionDialogs"
import { messageTargetAtom, messageActionTargetAtom } from "@utils/channelAtoms"
import { ScrollViewportContext } from "@hooks/useHasBeenInView"
import { createDateTracker, DateTrackerContext, FloatingDatePill, type DateOrderEntry } from "./messageDateTracker"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/** Pill stays for this long after the last scroll event, then fades out. */
const SCROLL_IDLE_MS = 1200

/** How long a navigated-to message stays highlighted. */
const HIGHLIGHT_DURATION_MS = 4000

export type ChatStreamProps = {
    /** Channel, DM channel, or thread id — threads are channels too. */
    channelID: string
    /** Newline-separated pinned message ids (from the channel doc). */
    pinnedMessagesString?: string
}

/**
 * The message stream: a windowed, bottom-anchored list of messages.
 *
 * Self-contained and reusable — give it a channel id and it fetches, paginates,
 * and scrolls on its own. Pages compose it next to their own headers, inputs,
 * and drawers (channel page, DM page, thread drawer, threads page).
 */
export default function ChatStream({ channelID, pinnedMessagesString }: ChatStreamProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    // Deep link (?message_id= from notifications, search, shared URLs). Passed to
    // the hook so the channel's FIRST fetch is already centered on the target.
    const deepLinkMessageID = searchParams.get("message_id")

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

    const [targetMessageID, setTargetMessageID] = useAtom(messageTargetAtom(channelID))
    const [highlightedID, setHighlightedID] = useState<string | null>(null)
    /** Message the action menu is acting on — highlighted so the user knows the target. */
    const actionTarget = useAtomValue(messageActionTargetAtom)
    /** Tracks the one around-fetch attempted per target, so unknown ids fail gracefully. */
    const attemptedFetchRef = useRef<string | null>(null)

    // Deep links feed the same targeting path as reply clicks. Re-run when the
    // message id changes too (not just the channel): a deep link into the channel
    // you're already viewing — e.g. consecutive jumps from search — keeps the same
    // channelID, so gating on channelID alone would skip the highlight.
    useEffect(() => {
        attemptedFetchRef.current = null
        if (deepLinkMessageID) setTargetMessageID(deepLinkMessageID)
    }, [channelID, deepLinkMessageID])

    // Out-of-window target: replace the window with a page around it — once.
    // If the fetch lands without the target (deleted/foreign id), give up quietly.
    useEffect(() => {
        if (!targetMessageID) return
        if (channelMessagesStore.getState(channelID).byId.has(targetMessageID)) return
        if (attemptedFetchRef.current === targetMessageID) {
            setTargetMessageID(null)
            return
        }
        attemptedFetchRef.current = targetMessageID
        jumpToMessage(targetMessageID)
    }, [targetMessageID, blocks])

    /** The scroll engine centered the target: highlight it and clean up the URL. */
    const onTargetSettled = useCallback(
        (messageID: string) => {
            setTargetMessageID(null)
            setHighlightedID(messageID)
            if (searchParams.get("message_id") === messageID) {
                const next = new URLSearchParams(searchParams)
                next.delete("message_id")
                setSearchParams(next, { replace: true })
            }
        },
        [searchParams, setSearchParams, setTargetMessageID],
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

    // The pill shows while scrolling and fades out shortly after the user stops.
    const scrollIdleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const handleScroll = useCallback(() => {
        onScroll()
        tracker.setScrolling(true)
        clearTimeout(scrollIdleTimer.current)
        scrollIdleTimer.current = setTimeout(() => tracker.setScrolling(false), SCROLL_IDLE_MS)
    }, [onScroll, tracker])
    useEffect(() => () => clearTimeout(scrollIdleTimer.current), [])

    return (
        <ScrollViewportContext.Provider value={viewport}>
            <DateTrackerContext.Provider value={tracker}>
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                    <FloatingDatePill />
                    <MessageActionMenu channelID={channelID}>
                        <div
                            ref={containerRef}
                            onScroll={handleScroll}
                            // Keep the fade very subtle: a small mask only nibbles the very edge. A
                            // container mask unavoidably fades ANY content at the edge (incl. images),
                            // so the smaller the region the less an image visibly dissolves on scroll.
                            className="dark:scroll-fade [--scroll-fade-t-size:2rem] [--scroll-fade-b-size:2rem] flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [overflow-anchor:none]"
                        >
                            <div className="flex min-w-0 w-full flex-col px-3 pb-4">
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
                                        {blocks.map((block) =>
                                            block.message_type === "date" ? (
                                                <DateSeparator label={block.creation} name={block.name} key={block.name} />
                                            ) : block.message_type === "unread" ? (
                                                <UnreadSeparator key={block.name} />
                                            ) : block.message_type === "batch" ? (
                                                <div
                                                    key={block.name}
                                                    data-message-id={block.messages[0].name}
                                                    data-batch-root=""
                                                    className={cn(
                                                        "flex flex-col rounded-md transition-colors duration-700",
                                                        block.messages.some((member) => member.name === highlightedID) &&
                                                        "bg-surface-amber-2",
                                                        block.messages.some((member) => member.name === actionTarget?.name) &&
                                                        "bg-surface-gray-2",
                                                    )}
                                                >
                                                    <BatchMessageItem block={block} onInView={onMessageInView} />
                                                </div>
                                            ) : block.message_type === "System" ? (
                                                <SystemMessage
                                                    message={block.text ?? ""}
                                                    time={block.creation}
                                                    key={block.name}
                                                />
                                            ) : (
                                                <div
                                                    key={block.name}
                                                    data-message-id={block.name}
                                                    // Deliberately NO content-visibility: placeholder estimates change height
                                                    // after paint and break exact scroll compensation on prepend.
                                                    className={cn(
                                                        "flex flex-col rounded-md transition-colors duration-700",
                                                        highlightedID === block.name && "bg-surface-amber-2",
                                                        actionTarget?.name === block.name && "bg-surface-gray-2",
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
                    <MessageActionDialogs />

                    {showJumpButton && (
                        <div className="absolute bottom-3 right-4 z-50">
                            <Button
                                variant="outline"
                                size="sm"
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
