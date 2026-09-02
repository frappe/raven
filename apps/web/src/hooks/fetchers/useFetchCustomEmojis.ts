import { useFrappeGetDocList } from "frappe-react-sdk"
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
        errorRetryCount: 2,
        keepPreviousData: true
    })

    return { data, isLoading, error, mutate }
}
