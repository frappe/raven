import type { KlipyGif, KlipyPage } from "@lib/klipy"

export type GifSearchState = {
    query: string
    items: KlipyGif[]
    page: number
    hasNext: boolean
    status: "idle" | "loading" | "error"
    rateLimited: boolean
}

export type GifSearchAction =
    | { type: "query"; query: string }
    | { type: "loaded"; page: KlipyPage }
    | { type: "failed"; rateLimited: boolean }
    | { type: "loadMore" }
    | { type: "retry" }

/** Opens on trending (the empty query), already loading its first page. */
export const initialGifSearchState: GifSearchState = { query: "", items: [], page: 0, hasNext: true, status: "loading", rateLimited: false }

/** The picker's opening state: a remembered trending page, else trending to load. */
export const openGifSearch = (trending: KlipyPage | undefined): GifSearchState =>
    trending ? { ...initialGifSearchState, items: trending.items, page: 1, hasNext: trending.hasNext, status: "idle" } : initialGifSearchState

export const gifSearchReducer = (state: GifSearchState, action: GifSearchAction): GifSearchState => {
    switch (action.type) {
        case "query":
            if (action.query === state.query) return state
            return { ...initialGifSearchState, query: action.query }
        case "loaded":
            return { ...state, items: [...state.items, ...action.page.items], page: state.page + 1, hasNext: action.page.hasNext, status: "idle" }
        case "failed":
            return { ...state, status: "error", rateLimited: action.rateLimited }
        case "loadMore":
            // Not after an error: scrolling would keep hitting a failing or rate-limited key. Retry is explicit.
            if (!state.hasNext || state.status !== "idle") return state
            return { ...state, status: "loading" }
        case "retry":
            // Refetches the page that failed; pages already shown stay.
            if (state.status !== "error") return state
            return { ...state, status: "loading" }
    }
}
