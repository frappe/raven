import { useFrappeGetDocCount, useFrappeGetDocList } from "frappe-react-sdk"
import { RavenCustomEmoji } from '@raven/types/RavenMessaging/RavenCustomEmoji'
import { PaginationState, SortingState } from "src/types/DataTable"

/**
 * Fetches custom emojis with optional sorting and pagination.
 */
export const useFetchCustomEmojis = (sorting?: SortingState, pagination?: PaginationState) => {
    const limitStart = pagination ? pagination.pageIndex * pagination.pageSize : 0
    const limit = pagination?.pageSize ?? 20

    const { data, isLoading, error, mutate } = useFrappeGetDocList<RavenCustomEmoji>("Raven Custom Emoji", {
        fields: ["name", "emoji_name", "image", "keywords", "owner", "creation"],
        orderBy: sorting ? {
            field: sorting.field,
            order: sorting.order
        } : {
            field: "creation",
            order: "asc"
        },
        limit_start: limitStart,
        limit: limit
    }, undefined, {
        errorRetryCount: 2
    })

    return { data, isLoading, error, mutate }
}

/**
 * Fetches the total count of custom emojis.
 * Used for pagination to know total pages.
 */
export const useFetchCustomEmojisCount = () => {
    const { data, error, mutate } = useFrappeGetDocCount("Raven Custom Emoji")
    return { count: data ?? 0, error, mutate }
}
