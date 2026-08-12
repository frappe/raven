import { useLayoutEffect, useState } from "react"

/** Marks the row carrying the filter's current value — set by FilterComboboxItem. */
const CHOSEN_ROW_ATTR = "[data-filter-chosen]"

/**
 * A last re-apply after the list has settled, in ms. The observer below covers everything
 * that announces itself as a DOM change; this catches cmdk's selectFirstItem, which scrolls
 * its highlight into view without touching the DOM and so is invisible to the observer.
 */
const SETTLE_DELAY = 120

/**
 * Puts the filter list where it should start: on the current value when it opens — with 158
 * channels the chosen one is usually far below the fold, so opening at row 1 gives no sign of
 * what's already picked — and back at the top on every keystroke, where the best matches are.
 *
 * Returns a ref to put on the scroll container. It's a callback ref held in state, not a
 * useRef: the popover mounts its content AFTER the effect that opens it runs, so a plain ref
 * is still null then. That silently skipped the whole thing on the first open of a session —
 * every later open worked, because this popover keeps its content mounted once created.
 *
 * @param open Whether the popover is open.
 * @param search The current search text; "" means browsing.
 * @param gutter The list's top padding, in px — the chosen row sits just below it.
 */
export const useFilterListScroll = (open: boolean, search: string, gutter: number) => {
    const [container, setContainer] = useState<HTMLDivElement | null>(null)

    useLayoutEffect(() => {
        if (!open || !container) return

        const applyScroll = search
            ? () => { container.scrollTop = 0 }
            : () => {
                const chosen = container.querySelector<HTMLElement>(CHOSEN_ROW_ATTR)
                if (!chosen || container.clientHeight === 0) return
                // Aligning to the row's own offset (rather than centring it) is what keeps
                // whole rows below it: the list tiles from there, so the viewport's bottom
                // edge lands on a boundary even though group headings are a different height.
                // offsetTop, not getBoundingClientRect: the popover's open animation leaves a
                // scale() on the subtree and every rect comes back 5% short. Set on the
                // container directly — scrollIntoView walks every scrollable ancestor and
                // would drag the page under the popover with it.
                container.scrollTop = chosen.offsetTop - gutter
            }

        // Once now, then again whenever the list changes under us. Setting the position a
        // single time never held, for two reasons:
        //  - opening: the rows aren't in the DOM yet in the first tick, so there is nothing
        //    to measure or scroll to;
        //  - searching: cmdk scrolls its newly selected item into view at the item's PRE-SORT
        //    position and only then re-sorts it to the top, which stranded the list mid-way —
        //    hovering a row and typing left it at 1647px with the top match off-screen.
        // Both announce themselves as DOM changes (rows mounting, cmdk reordering), so an
        // observer reacts exactly when it matters. childList only: cmdk also flips a
        // data-selected attribute as the pointer moves over rows, and re-scrolling on that
        // would drag the list out from under the reader.
        applyScroll()
        const observer = new MutationObserver(applyScroll)
        observer.observe(container, { childList: true, subtree: true })
        const settle = setTimeout(applyScroll, SETTLE_DELAY)

        const stop = () => {
            observer.disconnect()
            clearTimeout(settle)
        }
        // The user's first scroll wins: re-applying after they've started moving would yank
        // the list back. Listening for the input events rather than 'scroll', which our own
        // scrollTop would fire.
        container.addEventListener("wheel", stop, { once: true, passive: true })
        container.addEventListener("touchstart", stop, { once: true, passive: true })
        return () => {
            stop()
            container.removeEventListener("wheel", stop)
            container.removeEventListener("touchstart", stop)
        }
        // `search` is a dependency so each keystroke restarts the sequence and cancels the
        // previous one's pending retries.
    }, [open, search, gutter, container])

    return setContainer
}
