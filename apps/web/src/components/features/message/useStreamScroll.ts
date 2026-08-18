import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { StreamBlock } from "@stores/messages/types"
import type { Message } from "@raven/types/common/Message"
import { useUserCookieData } from "@hooks/useUserCookieData"

/** How close to the bottom (px) still counts as "at the bottom". */
const AT_BOTTOM_SLOP = 40
/** Distance from either content edge (px) at which the next page starts loading. */
const LOAD_MORE_THRESHOLD = 400
/** Gap (px) left above the "New messages" divider when landing on it, so prior context peeks in. */
const UNREAD_ANCHOR_TOP_MARGIN = 8

/** Owner of the newest actual message in the stream (skips date dividers, unwraps batches). */
const ownerOfNewestMessage = (blocks: StreamBlock[]): string | undefined => {
    const last = blocks[blocks.length - 1]
    if (!last) return undefined
    if (last.message_type === "batch") return last.messages[last.messages.length - 1]?.owner
    if (last.message_type === "date") return undefined
    return (last as Message).owner
}

type StreamScrollOptions = {
    channelID: string
    blocks: StreamBlock[]
    loadOlder: () => void
    loadNewer: () => void
    hasOlderMessages: boolean
    /** True when the window is detached from the live edge. */
    hasNewerMessages: boolean
    /** Message id the view should navigate to (reply click / deep link), or null. */
    targetMessageID: string | null
    /** Called once the target is centered in the viewport. */
    onTargetSettled: (messageID: string) => void
    /** True when a "New messages" divider exists in this window — the engine lands on it on entry. */
    hasUnreadDivider: boolean
}

/**
 * The chat stream's scroll engine. Scroll position is explicit state, not a
 * side effect: the stream is either *pinned* (follow the newest message) or
 * *free* (the user scrolled up and owns the viewport).
 *
 * Responsibilities:
 * - Pin to the bottom on first load, on channel switch, and while pinned —
 *   including when the container resizes (input grows, keyboard opens).
 * - Keep the viewport anchored when older messages prepend. Done manually
 *   with scrollHeight deltas because Safari does not support CSS
 *   `overflow-anchor` (the container also sets `overflow-anchor: none` so
 *   Chrome's native anchoring cannot fight the manual correction).
 * - Trigger `loadOlder` near the top; re-entry is guarded by the store.
 * - Surface "new messages arrived while scrolled up" for the jump pill.
 * - Navigate to a target message: suspend pinning, center the target once its
 *   block is in the DOM (directly for in-window targets; after the around-fetch
 *   replaces the window for out-of-window ones).
 */
export const useStreamScroll = ({
    channelID,
    blocks,
    loadOlder,
    loadNewer,
    hasOlderMessages,
    hasNewerMessages,
    targetMessageID,
    onTargetSettled,
    hasUnreadDivider,
}: StreamScrollOptions) => {
    const { name: currentUser } = useUserCookieData()
    const containerRef = useRef<HTMLDivElement>(null)
    /** True while the view should follow the newest message. */
    const pinnedRef = useRef(true)
    /** Last seen metrics, updated on every scroll — used for prepend compensation. */
    const metricsRef = useRef({ scrollTop: 0, scrollHeight: 0 })
    /**
     * The message at the top of the viewport while free-scrolled, plus its offset from
     * the container top. Lets a WIDTH change (e.g. the thread drawer opening, which
     * reflows every row) keep that message in place — the raw scrollTop would point at
     * different content once rows re-wrap.
     */
    const topAnchorRef = useRef<{ id: string; offset: number } | null>(null)
    const edgeIdsRef = useRef<{ first: string | null; last: string | null }>({ first: null, last: null })
    /** Land on the "New messages" divider on the first content render after a channel switch. */
    const unreadAnchorPendingRef = useRef(true)
    /** True while a smooth glide animates — pauses load-older so a prepend can't fight the animation. */
    const smoothScrollingRef = useRef(false)
    /**
     * After we scroll to a target message, nearby content keeps loading for a moment
     * (images, polls, thread pills — they load BECAUSE they just became visible) and each
     * one shifts the layout, pushing the target away from where we put it. So for a short
     * window after arrival, we keep re-centering the target whenever the content resizes.
     * Re-centering does nothing if the target hasn't moved. The window ends on its own
     * after TARGET_ANCHOR_MS, or immediately when the user scrolls, pins to the bottom,
     * or switches channels.
     */
    const targetAnchorRef = useRef<{ id: string; until: number } | null>(null)

    const [isAtBottom, setIsAtBottom] = useState(true)
    const [hasUnseenMessages, setHasUnseenMessages] = useState(false)

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
        const container = containerRef.current
        if (!container) return
        // Jumping to the present is an explicit exit from a targeted position.
        targetAnchorRef.current = null
        pinnedRef.current = true
        setHasUnseenMessages(false)
        container.scrollTo({ top: container.scrollHeight, behavior })
    }, [])

    const onScroll = useCallback(() => {
        const container = containerRef.current
        if (!container) return
        metricsRef.current = { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight }
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        const atBottom = distanceFromBottom <= AT_BOTTOM_SLOP
        // Pinning only means something at the LIVE edge — the bottom of a detached
        // window is just more history, and pinning there would skip past it.
        // Also: never re-arm pinning while we're navigating to a target message. A
        // scroll-to-target that starts near the bottom passes through the "at bottom"
        // zone on its first frames — if that armed pinning, the next layout shift
        // would snap the view from the target back to the bottom.
        const targetEngaged = smoothScrollingRef.current || targetAnchorRef.current !== null
        pinnedRef.current = !targetEngaged && atBottom && !hasNewerMessages
        setIsAtBottom(atBottom)
        if (atBottom && !hasNewerMessages) setHasUnseenMessages(false)

        // While free, remember the topmost visible message so a width change can keep
        // it anchored. Probe at the horizontal CENTER (the left edge is inside the
        // content's px-3 padding, where elementFromPoint misses the rows), scanning a
        // few offsets down from the top to skip a date separator / load-older spinner.
        // O(1)-ish vs. measuring every row; when pinned we anchor to the bottom instead.
        if (!pinnedRef.current) {
            const rect = container.getBoundingClientRect()
            const x = rect.left + rect.width / 2
            let block: Element | null = null
            for (const dy of [8, 40, 80, 120]) {
                block = document.elementFromPoint(x, rect.top + dy)?.closest("[data-message-id]") ?? null
                if (block) break
            }
            if (block) {
                topAnchorRef.current = { id: block.getAttribute("data-message-id") ?? "", offset: block.getBoundingClientRect().top - rect.top }
            }
        }
        // A prepend during a smooth glide would shift the animation's destination
        // out from under it — hold the prefetch until the animation settles.
        if (!smoothScrollingRef.current && container.scrollTop < LOAD_MORE_THRESHOLD) loadOlder()
        // Appends never move existing content, so no glide guard is needed downward.
        if (distanceFromBottom < LOAD_MORE_THRESHOLD) loadNewer()
    }, [loadOlder, loadNewer, hasNewerMessages])

    // A channel switch resets the engine: start pinned, nothing unseen, and arm the
    // one-shot "land on the unread divider" for this channel's first content render.
    useLayoutEffect(() => {
        pinnedRef.current = true
        edgeIdsRef.current = { first: null, last: null }
        unreadAnchorPendingRef.current = true
        targetAnchorRef.current = null
        setIsAtBottom(true)
        setHasUnseenMessages(false)
    }, [channelID])

    // Navigating to a message suspends pinning immediately, so neither the pin
    // effect nor the ResizeObserver fights the positioning while it loads.
    useLayoutEffect(() => {
        if (targetMessageID) pinnedRef.current = false
    }, [targetMessageID])

    // React to content changes — runs before paint so corrections are invisible.
    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container || blocks.length === 0) return

        const first = blocks[0].name
        const last = blocks[blocks.length - 1].name
        const previous = edgeIdsRef.current
        edgeIdsRef.current = { first, last }

        // A navigation target (deep link / reply click) owns the scroll — never let the
        // unread anchor override where the user explicitly asked to go.
        if (targetMessageID) unreadAnchorPendingRef.current = false

        if (targetMessageID) {
            // Position the target if its block is in the DOM; otherwise hold
            // still — the around-fetch is replacing the window and this effect
            // re-runs when the new blocks land.
            // Fallback: some batch members render without their own data-message-id
            // node (the text/caption member, images collapsed inside a stack) — anchor
            // on their batch wrapper instead, which lists member ids in data-batch-member.
            const escaped = CSS.escape(targetMessageID)
            const block =
                container.querySelector(`[data-message-id="${escaped}"]`) ??
                container.querySelector(`[data-batch-member~="${escaped}"]`)
            if (block) {
                // Smooth gliding only means something when the target was already in
                // the loaded window. If this commit replaced the window (deep link,
                // around-fetch), the old scroll position is meaningless — jump.
                const windowReplaced =
                    previous.first === null || (first !== previous.first && last !== previous.last)
                const usedSmooth = centerInContainer(container, block, !windowReplaced)
                if (usedSmooth) {
                    smoothScrollingRef.current = true
                    const release = () => (smoothScrollingRef.current = false)
                    // scrollend where supported; timeout fallback for older Safari
                    container.addEventListener("scrollend", release, { once: true })
                    setTimeout(release, 1000)
                }
                // Keep it centered while nearby content finishes loading — see targetAnchorRef.
                targetAnchorRef.current = { id: targetMessageID, until: Date.now() + TARGET_ANCHOR_MS }
                onTargetSettled(targetMessageID)
            }
        } else if (unreadAnchorPendingRef.current) {
            // First content render after entering the channel: land on the "New messages"
            // divider (top-aligned, prior context peeking above) and go free, so reading from
            // there advances the watermark only by what's actually seen. Only CONSUME the
            // one-shot once resolved — divider found, or none expected — so a render where the
            // divider isn't in the DOM yet can't prematurely pin us to the bottom.
            const divider = container.querySelector("[data-unread-divider]")
            if (divider) {
                unreadAnchorPendingRef.current = false
                const top =
                    divider.getBoundingClientRect().top -
                    container.getBoundingClientRect().top +
                    container.scrollTop -
                    UNREAD_ANCHOR_TOP_MARGIN
                container.scrollTop = Math.max(0, top)
                pinnedRef.current = false
                // We're no longer at the live edge — tell the read tracker now, so it can't
                // treat this as "caught up" in the frame before the scroll event lands.
                setIsAtBottom(false)
            } else if (!hasUnreadDivider) {
                // Caught up — no divider coming. Pin to the bottom as usual.
                unreadAnchorPendingRef.current = false
                container.scrollTop = container.scrollHeight
            }
            // else: a divider is expected but hasn't rendered yet — keep waiting (don't pin).
        } else if (pinnedRef.current) {
            container.scrollTop = container.scrollHeight
        } else if (previous.first !== null && first !== previous.first) {
            // Older messages prepended above the viewport — hold position steady.
            const delta = container.scrollHeight - metricsRef.current.scrollHeight
            if (delta > 0) container.scrollTop = metricsRef.current.scrollTop + delta
        } else if (previous.last !== null && last !== previous.last) {
            // The bottom edge of the list changed. Why matters:
            // - At the live edge: a new message just arrived. If it's OUR send, jump to it
            //   (you should land on your own message); otherwise show the "new messages" pill.
            // - Detached from the live edge (e.g. after a deep link into history): scrolling
            //   down loads PAGES of older-to-newer history. Do nothing — those aren't new
            //   messages, and jumping would fling the user to the bottom mid-scroll whenever
            //   a fetched page happened to end with one of their own old sends.
            if (!hasNewerMessages) {
                if (ownerOfNewestMessage(blocks) === currentUser) {
                    container.scrollTop = container.scrollHeight
                    pinnedRef.current = true
                } else {
                    setHasUnseenMessages(true)
                }
            }
        }
        metricsRef.current = { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight }

        // A short first page may not fill the viewport — no scrollbar means no
        // scroll events, so trigger the next page directly.
        if (container.scrollHeight <= container.clientHeight) {
            if (hasOlderMessages) loadOlder()
            if (hasNewerMessages) loadNewer()
        }
    }, [blocks, targetMessageID])

    // Stay anchored through any resize. Two cases:
    //  - Pinned (at the live edge): the input growing, the keyboard opening, media
    //    settling — keep glued to the bottom.
    //  - Free: keep the message the user was looking at in place, whatever
    //    resized. Width changes (the thread drawer reflowing every row) and
    //    height changes (a link preview card resolving above the viewport,
    //    a Reddit embed shrinking to fit) both move content, and native
    //    anchoring is off (overflow-anchor: none), so this is the only
    //    thing holding the view steady. The correction restores the anchor
    //    message's OFFSET, so it is idempotent: after the content effect's
    //    exact prepend compensation the offset is already right and this
    //    no-ops. Changes below the anchor no-op the same way.
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const observer = new ResizeObserver(() => {

            // Keep a just-arrived target centered while nearby content finishes loading
            // (see targetAnchorRef). Checked BEFORE the pinned branch on purpose: while
            // this is active, holding the target wins over gluing to the bottom. Real
            // user actions that mean "go to the bottom" (scrolling there, the jump
            // button) clear the anchor first, so they aren't fought.
            const targetAnchor = targetAnchorRef.current
            if (targetAnchor) {
                if (Date.now() > targetAnchor.until) {
                    targetAnchorRef.current = null
                } else {
                    const escaped = CSS.escape(targetAnchor.id)
                    const block =
                        container.querySelector(`[data-message-id="${escaped}"]`) ??
                        container.querySelector(`[data-batch-member~="${escaped}"]`)
                    if (block) {
                        centerInContainer(container, block, smoothScrollingRef.current)
                        return
                    }
                }
            }

            if (pinnedRef.current) {
                targetAnchorRef.current = null
                container.scrollTop = container.scrollHeight
                return
            }

            // Don't fight an in-progress target glide.
            if (smoothScrollingRef.current) return

            const anchor = topAnchorRef.current
            if (!anchor) return
            const block = container.querySelector(`[data-message-id="${CSS.escape(anchor.id)}"]`)
            if (!block) return
            const currentOffset = block.getBoundingClientRect().top - container.getBoundingClientRect().top
            container.scrollTop += currentOffset - anchor.offset
        })
        observer.observe(container)
        if (container.firstElementChild) observer.observe(container.firstElementChild)

        // Real user scroll input takes over: stop holding the target centered. Wheel and
        // touch only fire for the user (programmatic scrolls don't), so this can't be
        // tripped by our own corrections.
        const cancelTargetAnchor = () => {
            targetAnchorRef.current = null
        }
        container.addEventListener("wheel", cancelTargetAnchor, { passive: true })
        container.addEventListener("touchmove", cancelTargetAnchor, { passive: true })

        return () => {
            observer.disconnect()
            container.removeEventListener("wheel", cancelTargetAnchor)
            container.removeEventListener("touchmove", cancelTargetAnchor)
        }
    }, [])

    return { containerRef, onScroll, isAtBottom, hasUnseenMessages, scrollToBottom }
}

/** Smooth scrolling only makes sense over short hops — beyond this it's a disorienting blur. */
const SMOOTH_SCROLL_RANGE_VIEWPORTS = 1.5

/** How long a just-arrived target message is kept centered while nearby content
 *  finishes loading — see targetAnchorRef. */
const TARGET_ANCHOR_MS = 2000

/**
 * Scrolls `element` to the vertical center of `container` without touching
 * ancestor scroll positions. Nearby targets scroll smoothly (spatial
 * continuity: "it's just up there"); distant ones jump instantly and let the
 * highlight mark the arrival. Reduced-motion users always jump.
 *
 * Returns whether a smooth animation was started, so the caller can guard
 * against concurrent scroll mutations until it settles.
 */
const centerInContainer = (container: HTMLElement, element: Element, allowSmooth: boolean): boolean => {
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const top = Math.max(
        0,
        elementRect.top - containerRect.top + container.scrollTop - (container.clientHeight - elementRect.height) / 2,
    )
    const distance = Math.abs(top - container.scrollTop)
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const useSmooth =
        allowSmooth && !prefersReducedMotion && distance <= container.clientHeight * SMOOTH_SCROLL_RANGE_VIEWPORTS

    container.scrollTo({ top, behavior: useSmooth ? "smooth" : "auto" })
    return useSmooth
}
