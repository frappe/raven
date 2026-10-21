import { useEffect, useState } from "react"
import { useFrappeGetCall, type GetDocListArgs } from "frappe-react-sdk"

/** The list-narrowing parts of a doc list query. The count must use the same ones. */
export type ListQuery<T = unknown> = Pick<GetDocListArgs<T>, "filters" | "orFilters">

/**
 * Page state + total count for a server-paginated settings list.
 * Keys are `${listKey}-p{n}-s{size}` (pages) and `${listKey}-count` —
 * SettingsRecordEditor prefix-invalidates everything under `listKey`.
 */
export const usePaginatedList = <T = unknown>(listKey: string, doctype: string, enabled: boolean, query?: ListQuery<T>) => {
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    // The count follows the same filters as the list, so pagination matches a search.
    // get_count's signature has no or_filters, but it counts through reportview, which
    // reads or_filters from the request itself. That works on Frappe v15 and v16 alike.
    // A count aggregate in get_list's fields does not: v15 only takes strings and v16
    // only takes dicts.
    const hasQuery = Boolean(query?.filters?.length || query?.orFilters?.length)
    const { data: countData, mutate: mutateCount } = useFrappeGetCall<{ message: number }>(
        "frappe.client.get_count",
        {
            doctype,
            filters: query?.filters,
            or_filters: query?.orFilters,
        },
        enabled ? `${listKey}-count${hasQuery ? `-q${JSON.stringify(query)}` : ""}` : null,
        { errorRetryCount: 2 },
    )
    const totalCount = countData?.message ?? 0

    // Deleting the last row of the last page leaves pageIndex past the end — clamp back.
    useEffect(() => {
        if (countData === undefined) return
        const lastPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1)
        if (pageIndex > lastPage) setPageIndex(lastPage)
    }, [countData, totalCount, pageSize, pageIndex])

    const onPageSizeChange = (size: number) => {
        setPageSize(size)
        setPageIndex(0)
    }

    return {
        pageIndex,
        pageSize,
        totalCount,
        /** Spread into the doclist options. */
        listArgs: { limit_start: pageIndex * pageSize, limit: pageSize },
        /** Per-page SWR key (null while disabled). */
        swrKey: enabled ? `${listKey}-p${pageIndex}-s${pageSize}` : null,
        onPageChange: setPageIndex,
        onPageSizeChange,
        /** For panels that own their mutations (the CRUD editors invalidate by key prefix instead). */
        mutateCount,
    }
}

export default usePaginatedList
