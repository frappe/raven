import { useCallback, useEffect, useReducer } from "react"
import { useDebounceCallback } from "usehooks-ts"
import { fetchGifs, KlipyError } from "@lib/klipy"
import { gifSearchReducer, initialGifSearchState } from "./gifSearchReducer"

const DEBOUNCE_MS = 300

/** KLIPY trending on open, search as the user types, the next page on loadMore. */
export const useGifSearch = () => {
    const [state, dispatch] = useReducer(gifSearchReducer, initialGifSearchState)
    const setQuery = useDebounceCallback((typed: string) => dispatch({ type: "query", query: typed.trim() }), DEBOUNCE_MS)

    const { query, page, status } = state
    useEffect(() => {
        if (status !== "loading") return
        // Not aborted: a superseded request still finishes, but its answer is ignored, so an
        // old query's GIFs never land in a new list (or twice, after retyping mid-request).
        let current = true
        fetchGifs({ query, page: page + 1 })
            .then(result => current && dispatch({ type: "loaded", page: result }))
            .catch(error => current && dispatch({ type: "failed", rateLimited: error instanceof KlipyError && error.status === 429 }))
        return () => { current = false }
    }, [query, page, status])

    const loadMore = useCallback(() => dispatch({ type: "loadMore" }), [])
    const retry = useCallback(() => dispatch({ type: "retry" }), [])

    return { state, setQuery, loadMore, retry }
}
