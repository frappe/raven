import { useLayoutEffect, useRef } from "react"

/** Anything with a `scrollTo({ top })`: a scrolling element or a Virtuoso handle. */
interface Scrollable {
    scrollTo: (options: ScrollToOptions) => void
}

/**
 * Pins a scrollable list back to the top whenever the search term changes.
 *
 * Lists that filter or re-rank on search swap a long list for a different, often much
 * shorter one, but the scroll container keeps its old offset. After scrolling down and
 * then typing, the best match sits above the fold.
 *
 * Returns a ref to put on the scroll container: a `CommandList`, a plain scrolling div,
 * or a `Virtuoso` (pass `VirtuosoHandle` as the type argument).
 */
export const useResetScrollOnSearch = <T extends Scrollable = HTMLDivElement>(search: string) => {
    const listRef = useRef<T>(null)

    // Layout effect so the reset lands before paint and there is no visible jump.
    useLayoutEffect(() => {
        listRef.current?.scrollTo({ top: 0 })
    }, [search])

    return listRef
}
