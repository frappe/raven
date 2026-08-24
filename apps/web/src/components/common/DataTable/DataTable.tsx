import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@components/ui/table"
import { Skeleton } from "@components/ui/skeleton"
import ErrorBanner from "@components/ui/error-banner"
import { cn } from "@lib/utils"
import { ArrowUpIcon, ArrowDownIcon, ChevronsUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { DataTableProps, ColumnDef, CellContext, HeaderContext, SortingState, PaginationState } from "../../../types/DataTable"
import { Button } from "@components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { TableVirtuoso } from "react-virtuoso"
import { forwardRef, useMemo } from "react"

/**
 * A reusable DataTable component for displaying tabular data.
 *
 * This is a basic building block that renders columns and rows based on
 * the provided column definitions and data array.
 *
 * @template TData - The type of data object in each row
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<User>[] = [
 *   { id: 'name', accessorKey: 'full_name', header: 'Name' },
 *   { id: 'email', accessorKey: 'email', header: 'Email' },
 * ]
 *
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   isLoading={isLoading}
 *   getRowId={(row) => row.name}
 * />
 * ```
 */
export function DataTable<TData>({
    columns,
    data,
    isLoading = false,
    error = null,
    getRowId,
    emptyState,
    className,
    tableClassName,
    // Sorting props
    sorting = null,
    onSortingChange,
    // Pagination props
    pagination,
    onPaginationChange,
}: DataTableProps<TData>) {

    const hasPagination = !!(pagination && onPaginationChange)
    const totalPages = hasPagination ? Math.ceil(pagination.totalCount / pagination.pageSize) : 0
    const canGoPrevious = hasPagination ? pagination.pageIndex > 0 : false
    const canGoNext = hasPagination ? pagination.pageIndex < totalPages - 1 : false

    const handlePreviousPage = () => {
        if (!hasPagination || !canGoPrevious) return
        onPaginationChange({
            ...pagination,
            pageIndex: pagination.pageIndex - 1,
        })
    }

    const handleNextPage = () => {
        if (!hasPagination || !canGoNext) return
        onPaginationChange({
            ...pagination,
            pageIndex: pagination.pageIndex + 1,
        })
    }

    const handlePageSizeChange = (newSize: string) => {
        if (!hasPagination) return
        onPaginationChange({
            ...pagination,
            pageSize: Number(newSize),
            pageIndex: 0,
        })
    }

    /**
     * Checks if a column is sortable.
     * A column is sortable if:
     * - enableSorting is explicitly true, OR
     * - enableSorting is undefined AND accessorKey is provided (default behavior)
     */
    const isColumnSortable = (column: ColumnDef<TData>): boolean => {
        if (column.enableSorting !== undefined) {
            return column.enableSorting
        }
        // Default: sortable if it has an accessorKey (maps to a real field)
        return column.accessorKey !== undefined
    }

    /**
     * Gets the current sort direction for a column.
     * Returns null if the column is not currently sorted.
     */
    const getColumnSortDirection = (column: ColumnDef<TData>): "asc" | "desc" | null => {
        if (!sorting) return null
        // Match by accessorKey (the field name) since that's what we sort by
        const sortField = column.accessorKey as string
        if (sorting.field === sortField) {
            return sorting.order
        }
        return null
    }

    /**
     * Handles click on a sortable column header.
     * Cycles through: asc -> desc -> no sort
     */
    const handleSortClick = (column: ColumnDef<TData>) => {
        if (!onSortingChange || !isColumnSortable(column)) return

        const field = column.accessorKey as string
        const currentDirection = getColumnSortDirection(column)

        let newSorting: SortingState | null
        if (currentDirection === null) {
            // Not sorted: start with ascending
            newSorting = { field, order: "asc" }
        } else if (currentDirection === "asc") {
            // Ascending: switch to descending
            newSorting = { field, order: "desc" }
        } else {
            // Descending: clear sort
            newSorting = null
        }

        onSortingChange(newSorting)
    }

    /**
     * Renders the sort indicator icon for a column.
     */
    const renderSortIcon = (column: ColumnDef<TData>) => {
        const direction = getColumnSortDirection(column)

        if (direction === "asc") {
            return <ArrowUpIcon className="ml-2 h-4 w-4" />
        }
        if (direction === "desc") {
            return <ArrowDownIcon className="ml-2 h-4 w-4" />
        }
        // No active sort: show neutral icon (only if sortable)
        return <ChevronsUpDownIcon className="ml-2 h-4 w-4 opacity-50" />
    }

    /**
     * Renders the header content for a column.
     * Supports both string headers and custom render functions.
     * Adds sorting functionality if the column is sortable.
     */
    const renderHeader = (column: ColumnDef<TData>) => {
        // Get the base header content
        let headerContent: React.ReactNode
        if (typeof column.header === 'function') {
            const context: HeaderContext<TData> = { column }
            headerContent = column.header(context)
        } else {
            headerContent = column.header
        }

        // If column is sortable and we have a sort handler, wrap in clickable element
        const sortable = isColumnSortable(column) && onSortingChange

        if (sortable) {
            return (
                <Button
                    className="flex items-center hover:text-ink-gray-8 transition-colors -ml-2 px-2 py-1 rounded"
                    onClick={() => handleSortClick(column)}
                    variant="ghost"
                    size="sm"
                >
                    {headerContent}
                    {renderSortIcon(column)}
                </Button>
            )
        }

        return headerContent
    }

    /**
     * Gets the cell value from a row using the column's accessorKey.
     * Uses type assertion since accessorKey is constrained to keyof TData.
     */
    const getCellValue = (row: TData, column: ColumnDef<TData>): unknown => {
        if (column.accessorKey) {
            // Type-safe access: accessorKey is keyof TData
            return (row as Record<string, unknown>)[column.accessorKey as string]
        }
        return undefined
    }

    /**
     * Renders the cell content for a column.
     * Uses custom cell renderer if provided, otherwise displays raw value.
     */
    const renderCell = (row: TData, column: ColumnDef<TData>, rowIndex: number) => {
        const value = getCellValue(row, column)

        if (column.cell) {
            const context: CellContext<TData> = {
                row,
                value,
                column,
                rowIndex,
            }
            return column.cell(context)
        }

        // Default: render the value as string (handles null/undefined gracefully)
        return value != null ? String(value) : ''
    }

    /**
     * Gets the unique key for a row.
     * Uses getRowId if provided, otherwise falls back to index.
     */
    const getRowKey = (row: TData, index: number): string => {
        if (getRowId) {
            return getRowId(row)
        }
        return String(index)
    }

    const virtuosoComponents = useMemo(() => ({
        Table: (props: any) => <Table {...props} className={tableClassName} />,
        TableHead: forwardRef<HTMLTableSectionElement, any>((props, ref) => <TableHeader {...props} ref={ref} />),
        TableBody: forwardRef<HTMLTableSectionElement, any>((props, ref) => <TableBody {...props} ref={ref} />),
        TableRow: (props: any) => <TableRow {...props} className="group" />,
    }), [tableClassName])

    return (
        <div className={cn("w-full flex flex-col", className)}>
            {/* Error Banner - displayed above the table when there's an error */}
            {error && <ErrorBanner error={error} />}

            {/* Loading State - skeleton rows */}
            {isLoading && !error && (
                <DataTableSkeleton columns={columns.length} rows={5} />
            )}

            {/* Table Content */}
            {!isLoading && !error && (
                <div className={cn("overflow-hidden bg-surface-base", !hasPagination && "flex flex-col h-full")}>
                    {hasPagination ? (
                        <Table className={tableClassName}>
                            <TableHeader>
                                <TableRow>
                                    {columns.map((column: ColumnDef<TData>) => (
                                        <TableHead
                                            key={column.id}
                                            className={column.headerClassName}
                                        >
                                            {renderHeader(column)}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length > 0 ? (
                                    data.map((row: TData, rowIndex: number) => (
                                        <TableRow key={getRowKey(row, rowIndex)} className="group">
                                            {columns.map((column: ColumnDef<TData>) => (
                                                <TableCell
                                                    key={column.id}
                                                    className={column.cellClassName}
                                                >
                                                    {renderCell(row, column, rowIndex)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    // Empty state when no data
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            {emptyState ?? (
                                                <span className="text-ink-gray-4">
                                                    No data available.
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    ) : (
                        <TableVirtuoso
                            data={data.length > 0 ? data : []}
                            className={cn("flex-1 w-full", tableClassName)}
                            components={virtuosoComponents}
                            overscan={100}
                            fixedHeaderContent={() => (
                                <TableRow className="bg-surface-base hover:bg-surface-base">
                                    {columns.map((column: ColumnDef<TData>) => (
                                        <TableHead key={column.id} className={column.headerClassName}>
                                            {renderHeader(column)}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            )}
                            itemContent={(index, row) => (
                                <>
                                    {columns.map((column: ColumnDef<TData>) => (
                                        <TableCell key={column.id} className={column.cellClassName}>
                                            {renderCell(row, column, index)}
                                        </TableCell>
                                    ))}
                                </>
                            )}
                        />
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            {hasPagination && pagination.totalCount > 0 && !isLoading && !error && (
                <DataTablePagination
                    pagination={pagination}
                    totalPages={totalPages}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                    onPreviousPage={handlePreviousPage}
                    onNextPage={handleNextPage}
                    onPageSizeChange={handlePageSizeChange}
                />
            )}
        </div>
    )
}

/**
 * Pagination controls for the DataTable.
 * Shows current page info, page size selector, and navigation buttons.
 */
interface DataTablePaginationProps {
    pagination: PaginationState
    totalPages: number
    canGoPrevious: boolean
    canGoNext: boolean
    onPreviousPage: () => void
    onNextPage: () => void
    onPageSizeChange: (size: string) => void
}

function DataTablePagination({
    pagination,
    totalPages,
    canGoPrevious,
    canGoNext,
    onPreviousPage,
    onNextPage,
    onPageSizeChange,
}: DataTablePaginationProps) {
    // Calculate display range: "1-10 of 100"
    const start = pagination.pageIndex * pagination.pageSize + 1
    const end = Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.totalCount)

    return (
        <div className="flex items-center justify-between py-4">
            {/* Left side: showing X-Y of Z */}
            <p className="text-sm text-ink-gray-4">
                Showing {start}-{end} of {pagination.totalCount}
            </p>

            {/* Right side: page size + navigation */}
            <div className="flex items-center gap-4">
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-gray-4">Rows per page</span>
                    <Select
                        value={String(pagination.pageSize)}
                        onValueChange={onPageSizeChange}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Page indicator */}
                <span className="text-sm text-ink-gray-4">
                    Page {pagination.pageIndex + 1} of {totalPages}
                </span>

                {/* Navigation buttons */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        isIconButton
                        onClick={onPreviousPage}
                        disabled={!canGoPrevious}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                        <span className="sr-only">Previous page</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        isIconButton
                        onClick={onNextPage}
                        disabled={!canGoNext}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                        <span className="sr-only">Next page</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}

/**
 * Loading skeleton for the DataTable.
 * Displays animated placeholder rows while data is being fetched.
 */
interface DataTableSkeletonProps {
    /** Number of columns to display */
    columns: number
    /** Number of skeleton rows to display */
    rows?: number
}

function DataTableSkeleton({ columns, rows = 5 }: DataTableSkeletonProps) {
    return (
        <div className="overflow-hidden rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: columns }).map((_, i) => (
                            <TableHead key={i}>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <TableCell key={colIndex}>
                                    <Skeleton className="h-4 w-full" />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export { DataTableSkeleton }
