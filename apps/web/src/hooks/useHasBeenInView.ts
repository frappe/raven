import { createContext, useContext, useRef } from "react"
import { useIntersectionObserver } from "usehooks-ts"

/**
 * The scroll viewport that in-view detection is measured against — a stream's scroll
 * container, supplied by ChatStream (and later the notifications list). Null falls back
 * to the browser viewport.
 *
 * Why the container and not `root: null`: an IntersectionObserver clips the target by
 * its scroll ancestors, so a scrolled-out message reads as not-visible either way — BUT
 * `rootMargin` prefetch only works when the margin extends the *scroll container's*
 * bounds. With `root: null` a scrolled-out row is clipped to an empty rect, so no margin
 * can pre-trigger it. Rooting at the container is what makes "fetch ~200px early" work.
 */
export const ScrollViewportContext = createContext<HTMLElement | null>(null)

type UseHasBeenInViewOptions = {
    /** Prefetch buffer — start "in view" this far before the element is actually visible. */
    rootMargin?: string
}

/**
 * Latches true the first time the element scrolls into (or near) the viewport, then
 * stops observing. The fetch-gate for a message's extra data: a parent renders a
 * skeleton until `hasBeenInView`, then mounts the data-fetching child — so a polls /
 * threads channel fetches only what the user actually sees, not all ~30 windowed
 * messages. (Latching + SWR's cache means scroll-out/in never re-fetches.)
 *
 * For a live "currently visible" need, use the non-latching sibling below — this one
 * freezes by design.
 */
export const useHasBeenInView = ({ rootMargin = "200px" }: UseHasBeenInViewOptions = {}) => {
    const root = useContext(ScrollViewportContext)
    const { ref, isIntersecting } = useIntersectionObserver({
        root,
        rootMargin,
        freezeOnceVisible: true,
    })
    return { ref, hasBeenInView: isIntersecting }
}

/**
 * Like useHasBeenInView, but keeps watching: `isInView` is live, `hasBeenInView`
 * still latches for lazy mounting. For things that need to re-check whenever the
 * element is on screen (e.g. a thread pill refetching a suspect reply count).
 */
export const useInView = ({ rootMargin = "200px" }: UseHasBeenInViewOptions = {}) => {
    const root = useContext(ScrollViewportContext)
    const { ref, isIntersecting } = useIntersectionObserver({ root, rootMargin })
    // Every visibility change re-renders, so latching in a ref is safe here.
    const seen = useRef(false)
    if (isIntersecting) seen.current = true
    return { ref, isInView: isIntersecting, hasBeenInView: seen.current }
}
