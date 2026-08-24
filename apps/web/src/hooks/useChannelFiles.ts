import { FrappeConfig, FrappeContext, useSWRInfinite } from "frappe-react-sdk"
import { useCallback, useContext, useMemo } from "react"
import { getFileName } from "@raven/lib/utils/operations"

/** A channel File/Image message, as the Files tab renders it. Shaped like the
 *  old SqliteSearch row so the tab's rendering/preview code is unchanged;
 *  `title` and the file extension are derived on the client (see below). */
export type ChannelFile = {
    id: string
    title: string
    internal_link: string
    message_type?: string
    file_size?: number
    file_thumbnail?: string
    thumbnail_width?: number
    thumbnail_height?: number
    author: string
    creation: string
}

/** Raw row from get_channel_files (title derived on the client from the URL). */
type ChannelFileRow = Omit<ChannelFile, "title">

const toChannelFile = (row: ChannelFileRow): ChannelFile => ({
    ...row,
    // Filename from the file path — the same way message attachments do it.
    title: getFileName(row.internal_link ?? ""),
})

type FilePageKey = {
    api: "raven.api.search.get_channel_files"
    channel_id: string
    search_text: string
    limit: number
    cursor_creation?: string
    cursor_id?: string
}

/**
 * Paginated list of a channel's files, read straight from MariaDB via
 * get_channel_files — NOT the SQLite search index.
 *
 * Why not the search index: it is updated by a background queue every ~5
 * minutes, so a just-uploaded file did not appear in this tab (even on
 * refresh) until the queue ran. MariaDB is the source of truth, so new files
 * show immediately.
 *
 * Keyset cursor on (creation, id) — each page asks for rows older than the
 * last row of the previous page, stable when new messages arrive mid-session.
 * `search` is a filename substring match.
 */
export const useChannelFilesInfinite = (
    channelID: string,
    search?: string,
    pageSize: number = 20,
) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const searchText = search ?? ""

    const getKey = useCallback(
        (pageIndex: number, previousPageData: ChannelFileRow[] | null): FilePageKey | null => {
            // A short page means the previous fetch drained the set.
            if (previousPageData && previousPageData.length < pageSize) return null
            const last = previousPageData?.[previousPageData.length - 1]
            return {
                api: "raven.api.search.get_channel_files",
                channel_id: channelID,
                search_text: searchText,
                limit: pageSize,
                cursor_creation: last?.creation,
                cursor_id: last?.id,
            }
        },
        [channelID, searchText, pageSize],
    )

    const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<ChannelFileRow[]>(
        getKey,
        (key: FilePageKey) =>
            call
                .get<{ message: ChannelFileRow[] }>(key.api, {
                    channel_id: key.channel_id,
                    search_text: key.search_text,
                    limit: key.limit,
                    cursor_creation: key.cursor_creation,
                    cursor_id: key.cursor_id,
                })
                .then((res) => res.message),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            // Reopening the tab starts at one page — refetch it so files added
            // while closed show up. Cached rows still paint instantly.
            revalidateOnMount: true,
            revalidateFirstPage: false,
        },
    )

    // Flatten pages, dropping id repeats — a message deleted between fetches
    // shifts the keyset window back by one, which can echo a row.
    const results = useMemo(() => {
        if (!data) return []
        const seen = new Set<string>()
        const out: ChannelFile[] = []
        for (const page of data) {
            for (const row of page) {
                if (seen.has(row.id)) continue
                seen.add(row.id)
                out.push(toChannelFile(row))
            }
        }
        return out
    }, [data])

    const isLoadingMore = size > 0 && !!data && typeof data[size - 1] === "undefined"
    const lastPage = data?.[data.length - 1]
    const hasMore = !!lastPage && lastPage.length === pageSize

    const loadMore = useCallback(() => {
        if (!hasMore || isLoadingMore) return
        setSize((current) => current + 1)
    }, [hasMore, isLoadingMore, setSize])

    return {
        results,
        error,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        mutate,
    }
}
