import { useEffect, useState } from "react"
import { useFrappeGetCall } from "frappe-react-sdk"

/**
 * Page state + total count for a server-paginated settings list.
 * Keys are `${listKey}-p{n}-s{size}` (pages) and `${listKey}-count` —
 * SettingsRecordEditor prefix-invalidates everything under `listKey`.
 */
export const usePaginatedList = (listKey: string, doctype: string, enabled: boolean) => {
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const { data: countData, mutate: mutateCount } = useFrappeGetCall<{ message: number }>(
        "frappe.client.get_count",
        { doctype },
        enabled ? `${listKey}-count` : null,
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
