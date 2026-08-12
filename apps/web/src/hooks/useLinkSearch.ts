import { useFrappeGetCall } from "frappe-react-sdk"
import { useMemo } from "react"
import { SearchFilters } from "@components/features/search/types"

export type LinkSearchResult = {
    id: string
    channel_id: string
    creation: string
    author: string
    content: string
    is_direct_message: 0 | 1
    is_thread: 0 | 1
    channel_type: string
    parent_channel_id?: string
    url: string
    provider?: string
    title?: string
    description?: string
    image?: string
    site_name?: string
}

type ApiParams = Record<string, string | number>

// Flattens filters into a flat object for the API: 
// skips undefined/null/empty-string values,
// drops array-typed filters (message_type and file_type), 
// stable SWR cache key.
const buildParams = (query: string | undefined, filters: SearchFilters | undefined, limit: number): ApiParams => {
    const out: ApiParams = { limit }
    if (query) out.search_text = query
    if (!filters) return out

    const passthrough: (keyof SearchFilters)[] = [
        'channel_id',
        'owner',
        'is_thread',
    ]
    for (const k of passthrough) {
        const v = filters[k]
        if (v === '' || v === null || v === undefined) continue
        if (Array.isArray(v)) continue
        out[k] = v as string | number
    }

    // Picker option ids ARE the server's provider names — one vocabulary
    // end to end (option id, URL param, API filter).
    if (filters.link_provider?.length) {
        out.providers = JSON.stringify(filters.link_provider)
    }

    return out
}

export const useLinkSearch = (query?: string, filters?: SearchFilters, limit: number = 50) => {
    // `query` is used AS GIVEN — no debounce here. Callers own debouncing (at
    // the input via useDebounceValue, or once at the page level): a pre-debounced
    // caller must not pay a second lag, and only input-site debouncing can
    // prevent re-renders — a hook-internal value debounce never could.
    const searchText = query ?? ''

    const apiParams = useMemo(() => buildParams(searchText, filters, limit),
        [searchText, JSON.stringify(filters), limit])

    const swrKey = useMemo(
        () => `raven.api.search.search_links?${JSON.stringify(apiParams)}`,
        [apiParams],
    )

    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: LinkSearchResult[] }>(
        'raven.api.search.search_links',
        apiParams,
        swrKey,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: true,
        },
    )

    return {
        results: data?.message ?? [],
        error,
        isLoading,
        mutate,
    }
}
