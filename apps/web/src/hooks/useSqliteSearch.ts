import { useFrappeGetCall } from "frappe-react-sdk"
import { useMemo } from "react"
import { expandFileTypeGroups } from "@components/common/filters/FileTypeFilter"
import { SearchFilters } from "@components/features/search/types";

export type SearchResult = {
    name: string;
    id: string;
    score: number;
    original_rank: number;
    modified_rank: number;
    bm25_score: number | null;
    title: string;
    content: string;
    author: string;
    channel_id: string;
    creation: string;
    parent_channel_id?: string;
    mentions?: string;
    is_thread?: 1 | 0;
    message_type?: string;
    is_bot_message?: 1 | 0;
    bot?: string;
    poll_id?: string;
    file_type?: string;
    file_size?: number;
    internal_link?: string;
    preview_data?: string;
};

type ApiFilters = Record<string, string | number | string[]>

const normalizeFilters = (filters: SearchFilters): ApiFilters => {
    // remove empty values and expand file type groups
    // we will probably not need this when file search removed from sqlite search
    const out: ApiFilters = {}
    for (const [key, value] of Object.entries(filters)) {
        if (key === 'query') continue
        if (value === '' || value === null || value === undefined) continue
        if (Array.isArray(value) && value.length === 0) continue
        if (key === 'file_type' && Array.isArray(value)) {
            out[key] = expandFileTypeGroups(value)
        }
        else {
            out[key] = value as string | number | string[]
        }
    }
    return out
}

/**
 * Hook to search messages, files, links, polls and threads via the sqlite FTS index.
 *
 * The index is the single source of results: every query goes to the server as typed.
 * Short queries therefore behave as sqlite FTS defines them — tokens under 4 chars match
 * exactly rather than by prefix.
 *
 * @param query - User search input. `query` is used AS GIVEN — no debounce here;
 *                callers own debouncing (see useLinkSearch for the reasoning).
 * @param filters - Server-side filters (channel, author, message_type, etc.).
 * @param limit - Max rows fetched. Default 20.
 */
export const useSqliteSearch = (
    query?: string,
    filters?: SearchFilters,
    limit: number = 20,
) => {
    const searchText = query ?? ''

    const apiFilters = useMemo(() => {
        if (filters) {
            return normalizeFilters(filters)
        }
    }, [JSON.stringify(filters)])

    const swrKey = useMemo(() =>
        `raven.api.search.sqlite_search?query=${searchText}&filters=${JSON.stringify(apiFilters)}&limit=${limit}`,
        [searchText, apiFilters, limit]
    )

    const { data, error, isLoading, mutate } = useFrappeGetCall<{
        message: SearchResult[]
    }>(
        'raven.api.search.sqlite_search',
        {
            query: searchText,
            filters: apiFilters,
            limit
        },
        swrKey,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: true
        }
    )

    const results = data?.message || []

    return {
        results,
        error,
        isLoading,
        mutate
    }
}
