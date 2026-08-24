import { ReactNode } from "react"
import { FrappeError } from "frappe-react-sdk"

/**
 * Represents the current sorting state of the table.
 * Maps directly to Frappe's order_by parameter format.
 *
 * @example
 * const sorting: SortingState = { field: 'creation', order: 'desc' }
 *
 */
export interface SortingState {
    /** The field/column to sort by (must match a field in your doctype) */
    field: string
    /** Sort direction: 'asc' for ascending (A-Z, 0-9), 'desc' for descending */
    order: "asc" | "desc"
}

/**
 * Represents the current pagination state of the table.
 * Designed to work with Frappe's limit_start and limit_page_length parameters.
 *
 * @example
 * const pagination: PaginationState = {
 *   pageIndex: 1,    // 0-based index
 *   pageSize: 20,
 *   totalCount: 100  // Total items in database
 * }
 *
 */
export interface PaginationState {
    /** Current page index (0-based: first page = 0) */
    pageIndex: number
    /** Number of rows per page */
    pageSize: number
    /** Total number of rows in the dataset (from server) */
    totalCount: number
}

// COLUMN & CELL CONTEXT TYPES

/**
 * Context passed to the header render function.
 * Contains the column definition for custom header rendering.
 */
export interface HeaderContext<TData> {
    /** The column definition this header belongs to */
    column: ColumnDef<TData>
}

/**
 * Context passed to the cell render function.
 * Provides access to both the row data and column definition.
 */
export interface CellContext<TData> {
    /** The entire row data object */
    row: TData
    /** The value of this specific cell (from accessorKey) */
    value: unknown
    /** The column definition this cell belongs to */
    column: ColumnDef<TData>
    /** Index of the row in the data array */
    rowIndex: number
}

/**
 * Defines a column in the DataTable.
 * Each column specifies how to access and render data for that column.
 *
 * @template TData - The type of data object in each row
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<User>[] = [
 *   {
 *     id: 'name',
 *     accessorKey: 'full_name',
 *     header: 'Name'
 *   },
 *   {
 *     id: 'status',
 *     accessorKey: 'enabled',
 *     header: 'Status',
 *     cell: ({ value }) => <Badge>{value ? 'Active' : 'Inactive'}</Badge>
 *   }
 * ]
 * ```
 */
export interface ColumnDef<TData> {
    /**
     * Unique identifier for the column.
     * Used as React key and for column operations.
     */
    id: string

    /**
     * The key in the data object to access the cell value.
     * If not provided, you must use a custom cell renderer.
     */
    accessorKey?: keyof TData

    /**
     * Column header content.
     * Can be a string for simple headers, or a function for custom rendering.
     */
    header?: string | ((context: HeaderContext<TData>) => ReactNode)

    /**
     * Custom cell renderer function.
     * If not provided, displays the raw value from accessorKey.
     * Use this for formatting, adding badges, links, etc.
     */
    cell?: (context: CellContext<TData>) => ReactNode

    /**
     * Additional CSS class names to apply to the header cell (th).
     */
    headerClassName?: string

    /**
     * Additional CSS class names to apply to each data cell (td).
     */
    cellClassName?: string

    /**
     * Whether this column can be sorted.
     * When true, clicking the header will trigger sorting.
     * Default: true (if accessorKey is provided)
     */
    enableSorting?: boolean

    /**
     * Custom metadata for the column.
     * Can be used to store any additional information needed by your app.
     */
    meta?: Record<string, unknown>
}

/**
 * Props for the DataTable component.
 *
 * @template TData - The type of data object in each row
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   isLoading={isLoading}
 *   error={error}
 *   getRowId={(row) => row.name}
 * />
 * ```
 */
export interface DataTableProps<TData> {
    /**
     * Array of column definitions.
     * Defines what columns to display and how to render them.
     */
    columns: ColumnDef<TData>[]

    /**
     * Array of data objects to display in the table.
     * Each object represents a row.
     */
    data: TData[]

    /**
     * Whether the data is currently loading.
     * When true, displays a loading skeleton.
     */
    isLoading?: boolean

    /**
     * Error object from data fetching.
     * When present, displays an error banner above the table.
     */
    error?: FrappeError | null

    /**
     * Function to extract a unique identifier from each row.
     * Used as the React key for each row.
     * If not provided, falls back to row index (not recommended).
     *
     * @param row - The row data object
     * @returns A unique string identifier for the row
     */
    getRowId?: (row: TData) => string

    /**
     * Content to display when data array is empty.
     * If not provided, displays a default "No data" message.
     */
    emptyState?: ReactNode

    /**
     * Additional CSS class names for the table container.
     */
    className?: string

    /**
     * Additional CSS class names for the table element.
     */
    tableClassName?: string

    // SORTING PROPS

    /**
     * Current sorting state.
     * Pass null for no sorting.
     */
    sorting?: SortingState | null

    /**
     * Callback fired when user clicks a sortable column header.
     * Use this to update your sorting state and refetch data.
     *
     * @param sorting - The new sorting state, or null to clear sorting
     */
    onSortingChange?: (sorting: SortingState | null) => void

    // PAGINATION PROPS

    /**
     * Current pagination state.
     * When provided, the table will show pagination controls.
     */
    pagination?: PaginationState

    /**
     * Callback fired when user changes page or page size.
     * Use this to update your pagination state and refetch data.
     *
     * @param pagination - The new pagination state
     */
    onPaginationChange?: (pagination: PaginationState) => void
}
