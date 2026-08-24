import { useState, useCallback, useMemo } from "react"
import { useDebounceValue } from "usehooks-ts"
import type { SortingState, PaginationState } from "../types/DataTable"

/**
 * Configuration options for useDataTableState hook.
 */
export interface UseDataTableStateOptions {
    /** Initial page size. Default: 20 */
    defaultPageSize?: number
    /** Initial sorting state. Default: null (no sorting) */
    defaultSorting?: SortingState | null
    /** Debounce delay for filter input in milliseconds. Default: 300 */
    filterDebounceMs?: number
}

/**
 * Return type of useDataTableState hook.
 * Contains all state values and handlers needed for the DataTable.
 */
export interface UseDataTableStateReturn {
    // Pagination
    pagination: PaginationState
    setPagination: (pagination: PaginationState) => void
    setPageIndex: (pageIndex: number) => void
    setPageSize: (pageSize: number) => void
    setTotalCount: (totalCount: number) => void

    // Sorting
    sorting: SortingState | null
    setSorting: (sorting: SortingState | null) => void
    toggleSort: (field: string) => void

    // Filtering
    filterValue: string
    setFilterValue: (value: string) => void
    debouncedFilterValue: string

    // Row Selection
    selectedRows: Record<string, boolean>
    setSelectedRows: (selection: Record<string, boolean>) => void
    toggleRowSelection: (rowId: string) => void
    toggleAllRows: (rowIds: string[], selected: boolean) => void
    clearSelection: () => void
    selectedCount: number

    // Frappe API helpers
    /** Returns params ready to spread into useFrappeGetDocList options */
    getFrappeListParams: () => {
        limit_start: number
        limit_page_length: number
        order_by?: string
    }
}

/**
 * Hook to manage DataTable state (pagination, sorting, filtering, selection).
 *
 * This hook provides a convenient way to manage all table state in one place,
 * with helpers that generate Frappe-compatible API parameters.
 *
 * @example
 * ```tsx
 * const tableState = useDataTableState({ defaultPageSize: 20 })
 *
 * const { data } = useFrappeGetDocList('User', {
 *   fields: ['name', 'full_name', 'email'],
 *   filters: tableState.debouncedFilterValue
 *     ? [['full_name', 'like', `%${tableState.debouncedFilterValue}%`]]
 *     : [],
 *   ...tableState.getFrappeListParams(),
 * })
 *
 * return (
 *   <DataTable
 *     data={data}
 *     sorting={tableState.sorting}
 *     onSortingChange={tableState.setSorting}
 *     pagination={tableState.pagination}
 *     onPaginationChange={tableState.setPagination}
 *   />
 * )
 * ```
 */
export function useDataTableState(
    options: UseDataTableStateOptions = {}
): UseDataTableStateReturn {
    const {
        defaultPageSize = 20,
        defaultSorting = null,
        filterDebounceMs = 300,
    } = options

    // PAGINATION STATE

    const [pagination, setPaginationState] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: defaultPageSize,
        totalCount: 0,
    })

    const setPagination = useCallback((newPagination: PaginationState) => {
        setPaginationState(newPagination)
    }, [])

    const setPageIndex = useCallback((pageIndex: number) => {
        setPaginationState((prev) => ({ ...prev, pageIndex }))
    }, [])

    const setPageSize = useCallback((pageSize: number) => {
        // Reset to first page when page size changes
        setPaginationState((prev) => ({ ...prev, pageSize, pageIndex: 0 }))
    }, [])

    const setTotalCount = useCallback((totalCount: number) => {
        setPaginationState((prev) => ({ ...prev, totalCount }))
    }, [])

    // SORTING STATE

    const [sorting, setSorting] = useState<SortingState | null>(defaultSorting)

    /**
     * Toggle sort for a field.
     * Cycles through: asc -> desc -> no sort (null)
     */
    const toggleSort = useCallback((field: string) => {
        setSorting((current) => {
            if (!current || current.field !== field) {
                // New field or no current sort: start with ascending
                return { field, order: "asc" }
            }
            if (current.order === "asc") {
                // Currently ascending: switch to descending
                return { field, order: "desc" }
            }
            // Currently descending: clear sort
            return null
        })
        // Reset to first page when sorting changes
        setPageIndex(0)
    }, [setPageIndex])

    // FILTER STATE

    const [filterValue, setFilterValueState] = useState("")
    const [debouncedFilterValue] = useDebounceValue(filterValue, filterDebounceMs)

    const setFilterValue = useCallback((value: string) => {
        setFilterValueState(value)
        // Reset to first page when filter changes
        setPageIndex(0)
    }, [setPageIndex])

    // ROW SELECTION STATE

    const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})

    const toggleRowSelection = useCallback((rowId: string) => {
        setSelectedRows((prev) => {
            const newSelection = { ...prev }
            if (newSelection[rowId]) {
                delete newSelection[rowId]
            } else {
                newSelection[rowId] = true
            }
            return newSelection
        })
    }, [])

    const toggleAllRows = useCallback((rowIds: string[], selected: boolean) => {
        if (selected) {
            // Select all provided rows
            const newSelection: Record<string, boolean> = {}
            rowIds.forEach((id) => {
                newSelection[id] = true
            })
            setSelectedRows(newSelection)
        } else {
            // Clear selection
            setSelectedRows({})
        }
    }, [])

    const clearSelection = useCallback(() => {
        setSelectedRows({})
    }, [])

    const selectedCount = useMemo(
        () => Object.keys(selectedRows).length,
        [selectedRows]
    )

    // FRAPPE API HELPERS

    /**
     * Returns parameters compatible with useFrappeGetDocList.
     * Spread these into your API call options.
     */
    const getFrappeListParams = useCallback(() => {
        const params: {
            limit_start: number
            limit_page_length: number
            order_by?: string
        } = {
            limit_start: pagination.pageIndex * pagination.pageSize,
            limit_page_length: pagination.pageSize,
        }

        if (sorting) {
            params.order_by = `${sorting.field} ${sorting.order}`
        }

        return params
    }, [pagination.pageIndex, pagination.pageSize, sorting])

    return {
        // Pagination
        pagination,
        setPagination,
        setPageIndex,
        setPageSize,
        setTotalCount,

        // Sorting
        sorting,
        setSorting,
        toggleSort,

        // Filtering
        filterValue,
        setFilterValue,
        debouncedFilterValue,

        // Row Selection
        selectedRows,
        setSelectedRows,
        toggleRowSelection,
        toggleAllRows,
        clearSelection,
        selectedCount,

        // Frappe helpers
        getFrappeListParams,
    }
}
