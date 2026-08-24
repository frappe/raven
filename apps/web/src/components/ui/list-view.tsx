import * as React from "react"
import {
    type Cell,
    type ColumnDef,
    type ColumnSizingState,
    type Header,
    type OnChangeFn,
    type Row,
    type RowSelectionState,
    type SortingState,
    flexRender,
    functionalUpdate,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useDebounceCallback } from "usehooks-ts"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { Checkbox } from "@components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { useDirection } from "./direction"

/** Optional per-column layout hints for `ListView`. */
export type ListViewColumnMeta = {
    /** CSS grid track (`1fr`, `2fr`, `minmax(0,1fr)`). When set, used instead of TanStack pixel `size` in `grid-template-columns`. */
    gridWidth?: string
    align?: "left" | "center" | "right"
    /**
     * Tabular figures for stable digit width. Default: on when `align` is `right` (amounts); set `false` to opt out, or `true` for dates/IDs.
     */
    tabularNums?: boolean
    /**
     * Full text for an overflow tooltip (shown only when the cell truncates). If omitted, a string `accessorKey` value is used when available.
     */
    getTooltipText?: (row: unknown) => string | null | undefined
    /** `false` disables the overflow tooltip for this column. */
    truncateTooltip?: boolean
    /**
     * `false` skips single-line truncation for cells with custom layouts (e.g. action buttons). Default `true`.
     */
    truncate?: boolean
}

function alignClass(meta: ListViewColumnMeta | undefined) {
    switch (meta?.align) {
        case "center":
            return "justify-center text-center"
        case "right":
            return "justify-end text-end"
        default:
            return "justify-start text-start"
    }
}

function tabularNumsClass(meta: ListViewColumnMeta | undefined) {
    if (meta?.tabularNums === false) return ""
    if (meta?.tabularNums === true) return "tabular-nums"
    if (meta?.align === "right") return "tabular-nums"
    return ""
}

function resolveTooltipLabel<TData>(
    row: Row<TData>,
    meta: ListViewColumnMeta | undefined,
    columnDef: ColumnDef<TData, unknown>,
    columnId: string,
): string | undefined {
    if (meta?.truncateTooltip === false) return undefined
    const fromMeta = meta?.getTooltipText?.(row.original as unknown)
    if (fromMeta != null && String(fromMeta).length > 0) {
        return String(fromMeta)
    }
    // Only accessor-backed columns get an automatic tooltip — but the lookup
    // must use the column ID, not the accessorKey: TanStack registers columns
    // by id, and a column declaring BOTH (id: "membership", accessorKey:
    // "workspace_member_name") made getValue(accessorKey) miss — logging a
    // "[Table] Column ... does not exist" dev error per rendered cell.
    const hasAccessor = "accessorKey" in columnDef || "accessorFn" in columnDef
    if (hasAccessor) {
        try {
            const v = row.getValue(columnId)
            if (v != null && v !== "") return String(v)
        } catch {
            /* column may not expose a value */
        }
    }
    return undefined
}

function ListViewCellBody<TData>({
    cell,
    row,
    meta,
    children,
}: {
    cell: Cell<TData, unknown>
    row: Row<TData>
    meta: ListViewColumnMeta | undefined
    children: React.ReactNode
}) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [overflowing, setOverflowing] = React.useState(false)
    const direction = useDirection()

    const tooltipLabel = resolveTooltipLabel(row, meta, cell.column.columnDef, cell.column.id)
    const tooltipAlign = meta?.align === "right" && direction === "ltr" ? "end" : "start"

    const measure = React.useCallback(() => {
        const el = ref.current
        if (!el) return
        setOverflowing(el.scrollWidth > el.clientWidth + 1)
    }, [])

    React.useLayoutEffect(() => {
        measure()
    }, [measure, children, tooltipLabel])

    React.useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [measure])

    if (meta?.truncate === false) {
        return <div className="min-w-0 flex-1 overflow-visible">{children}</div>
    }

    // leading-snug: `truncate` sets overflow:hidden, so this div's box is its line
    // box — and the UI type scale's 1.15 is too tight to contain Inter's descenders
    // (Safari shaves them). Rows are fixed-height and center their cells, so the
    // taller line box re-centers rather than reflowing anything.
    const inner = (
        <div
            ref={ref}
            className="min-h-0 min-w-0 flex-1 truncate leading-snug"
        >
            {children}
        </div>
    )

    if (!tooltipLabel || !overflowing) {
        return inner
    }

    return (
        <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent
                side="bottom"
                align={tooltipAlign}
                className="max-w-sm text-balance wrap-break-word"
            >
                {tooltipLabel}
            </TooltipContent>
        </Tooltip>
    )
}

/** Has the user dragged this column to an explicit width? (entry present in the sizing state). */
function isUserResized<TData>(header: Header<TData, unknown>, columnSizing: ColumnSizingState): boolean {
    return columnSizing[header.column.id] != null
}

function gridTemplateFromHeaders<TData>(headers: Header<TData, unknown>[], columnSizing: ColumnSizingState) {
    return headers
        .map((header) => {
            const meta = header.column.columnDef.meta as ListViewColumnMeta | undefined
            // A user-dragged column becomes a FIXED px track (its resize handle is otherwise
            // inert against an `fr`/`minmax` gridWidth — the drag updates TanStack sizing but
            // the template must honor it). Flexible siblings then absorb the slack.
            if (isUserResized(header, columnSizing)) {
                return `${header.getSize()}px`
            }
            if (meta?.gridWidth) {
                return meta.gridWidth
            }
            return `${header.getSize()}px`
        })
        .join(" ")
}

/**
 * A column's true minimum pixel width — what it needs before the row must scroll.
 * A user-resized column contributes its chosen px width. Otherwise, for `gridWidth`
 * tracks the layout is CSS Grid, so the TanStack pixel `size` is a meaningless
 * placeholder (defaults to 150); the real floor is the `minmax(…px,…)` lower bound,
 * a bare `…px` track, or 0 for a pure `fr` track that can shrink freely. Columns
 * WITHOUT `gridWidth` fall back to the resolved TanStack size.
 */
function columnMinWidth<TData>(header: Header<TData, unknown>, columnSizing: ColumnSizingState): number {
    if (isUserResized(header, columnSizing)) {
        return header.getSize()
    }
    const meta = header.column.columnDef.meta as ListViewColumnMeta | undefined
    const gw = meta?.gridWidth
    if (gw) {
        const minmax = /minmax\(\s*([\d.]+)px/.exec(gw)
        if (minmax) return parseFloat(minmax[1])
        const fixed = /^\s*([\d.]+)px\s*$/.exec(gw)
        if (fixed) return parseFloat(fixed[1])
        return 0
    }
    return header.getSize()
}

function defaultGetRowId<TData>(row: TData, index: number) {
    const r = row as Record<string, unknown>
    if (r && typeof r.name === "string") return r.name
    if (r && typeof r.id === "string") return r.id
    return String(index)
}

export type ListViewProps<TData> = {
    data: TData[]
    columns: ColumnDef<TData, unknown>[]
    /**
     * Stable row id for selection and keys. Defaults to `name`, then `id`, then row index (index is fragile if data order changes).
     */
    getRowId?: (originalRow: TData, index: number) => string
    /** Pixel height of each body row (default 40, matches frappe-ui ListView). */
    rowHeight?: number
    className?: string
    /** Classes for the scrollable viewport (default includes max-height). */
    scrollAreaClassName?: string
    /** Max height of the scroll area; number is pixels. Default `420`. */
    maxHeight?: number | string
    emptyState?: React.ReactNode
    enableColumnResizing?: boolean
    columnSizing?: ColumnSizingState
    onColumnSizingChange?: OnChangeFn<ColumnSizingState>
    /** Debounced callback for persisting widths (e.g. localStorage). */
    onColumnSizingCommit?: (sizing: ColumnSizingState) => void
    columnSizingCommitDelayMs?: number
    enableRowSelection?: boolean
    rowSelection?: RowSelectionState
    onRowSelectionChange?: OnChangeFn<RowSelectionState>
    onRowClick?: (row: TData, event: React.MouseEvent) => void
    /**
     * Controlled sorting state (TanStack `SortingState`). ListView never reorders
     * `data` itself — it renders sortable headers + indicators and reports changes;
     * the consumer is responsible for ordering `data` (client memo or server fetch).
     * Sortable headers only appear when `onSortingChange` is provided.
     */
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
}

function ListViewInner<TData>({
    data,
    columns: userColumns,
    getRowId: getRowIdProp,
    rowHeight = 40,
    className,
    scrollAreaClassName,
    maxHeight = 420,
    emptyState,
    enableColumnResizing = true,
    columnSizing: controlledColumnSizing,
    onColumnSizingChange: controlledOnColumnSizingChange,
    onColumnSizingCommit,
    columnSizingCommitDelayMs = 250,
    enableRowSelection = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange: controlledOnRowSelectionChange,
    onRowClick,
    sorting,
    onSortingChange,
}: ListViewProps<TData>) {
    const parentRef = React.useRef<HTMLDivElement>(null)

    const [internalColumnSizing, setInternalColumnSizing] = React.useState<ColumnSizingState>({})
    const columnSizing = controlledColumnSizing ?? internalColumnSizing

    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})
    const rowSelection = controlledRowSelection ?? internalRowSelection
    const setRowSelection = controlledOnRowSelectionChange ?? setInternalRowSelection

    // Id of the column being dragged, for the active resize-guide styling.
    const [resizingColId, setResizingColId] = React.useState<string | null>(null)

    // Teardown for the drag in progress. A drag can end without pointerup —
    // pointercancel (touch claimed elsewhere), or this component unmounting
    // mid-drag — and without this the window listeners and the body's
    // select-none / col-resize cursor stuck around forever.
    const activeResizeCleanupRef = React.useRef<(() => void) | null>(null)
    React.useEffect(() => () => activeResizeCleanupRef.current?.(), [])

    const debouncedSizingCommit = useDebounceCallback(
        (sizing: ColumnSizingState) => {
            onColumnSizingCommit?.(sizing)
        },
        columnSizingCommitDelayMs,
    )

    const selectionColumn = React.useMemo<ColumnDef<TData, unknown>>(
        () => ({
            id: "__list_view_select__",
            size: 36,
            minSize: 36,
            maxSize: 36,
            enableResizing: false,
            meta: {
                truncate: false,
                truncateTooltip: false,
            } satisfies ListViewColumnMeta,
            header: ({ table }) => (
                <div className="flex size-full items-center justify-center">
                    <Checkbox
                        aria-label="Select all rows"
                        checked={
                            table.getIsAllRowsSelected()
                                ? true
                                : table.getIsSomeRowsSelected()
                                    ? "indeterminate"
                                    : false
                        }
                        onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex size-full items-center justify-center">
                    <Checkbox
                        aria-label="Select row"
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(value === true)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
        }),
        [],
    )

    const columns = React.useMemo(() => {
        if (!enableRowSelection) return userColumns
        return [selectionColumn, ...userColumns]
    }, [enableRowSelection, selectionColumn, userColumns])

    const getRowId = React.useCallback(
        (originalRow: TData, index: number) =>
            (getRowIdProp ?? defaultGetRowId)(originalRow, index),
        [getRowIdProp],
    )

    const onColumnSizingChangeInternal = React.useCallback<OnChangeFn<ColumnSizingState>>(
        (updater) => {
            if (controlledOnColumnSizingChange) {
                controlledOnColumnSizingChange(updater)
                return
            }
            setInternalColumnSizing((old) => {
                const next = functionalUpdate(updater, old)
                debouncedSizingCommit(next)
                return next
            })
        },
        [controlledOnColumnSizingChange, debouncedSizingCommit],
    )

    const direction = useDirection()

    // Sorting is MANUAL: ListView shows the controls + indicators but never
    // reorders `data` — the consumer supplies already-ordered rows.
    const sortingEnabled = !!onSortingChange

    const table = useReactTable({
        data,
        columns,
        defaultColumn: {
            minSize: 50,
            size: 150,
        },
        columnResizeMode: "onChange",
        columnResizeDirection: direction,
        enableColumnResizing,
        enableSorting: sortingEnabled,
        manualSorting: true,
        getCoreRowModel: getCoreRowModel(),
        getRowId,
        onColumnSizingChange: onColumnSizingChangeInternal,
        onRowSelectionChange: setRowSelection,
        onSortingChange,
        state: {
            columnSizing,
            rowSelection,
            sorting: sorting ?? [],
        },
        enableRowSelection,
    })

    /**
     * Custom column resize (replaces TanStack's `getResizeHandler`). Two reasons:
     *  - Starts from the column's ACTUAL rendered width, so the `fr`→`px` transition
     *    is seamless (TanStack would start from the 150px `size` placeholder, which
     *    jumps and mis-tracks the cursor on the first drag).
     *  - Clamps the dragged column's max so the table never grows past its container:
     *    max = container − (every other column's floor) − gaps − padding. Widening
     *    only shrinks the flexible siblings down to their floors, then stops.
     */
    const startColumnResize = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>, header: Header<TData, unknown>) => {
            e.preventDefault()
            e.stopPropagation()
            const colId = header.column.id
            const cell = (e.currentTarget as HTMLElement).closest('[role="columnheader"]') as HTMLElement | null
            const startWidth = cell?.getBoundingClientRect().width ?? header.getSize()
            const startX = e.clientX
            const dir = direction === "rtl" ? -1 : 1
            const minW = header.column.columnDef.minSize ?? 50

            const headers = table.getHeaderGroups()[0]?.headers ?? []
            const gaps = Math.max(0, headers.length - 1) * 16
            const sizingAtStart = table.getState().columnSizing
            const othersFloor = headers
                .filter((h) => h.column.id !== colId)
                .reduce((sum, h) => sum + columnMinWidth(h, sizingAtStart), 0)

            document.body.classList.add("select-none", "cursor-col-resize")
            setResizingColId(colId)

            const onMove = (ev: PointerEvent) => {
                const container = parentRef.current?.clientWidth ?? Number.POSITIVE_INFINITY
                const maxW = Number.isFinite(container)
                    ? Math.max(minW, container - othersFloor - gaps - 24)
                    : Number.POSITIVE_INFINITY
                let w = startWidth + (ev.clientX - startX) * dir
                w = Math.min(Math.max(w, minW), maxW)
                onColumnSizingChangeInternal((prev) => ({ ...prev, [colId]: Math.round(w) }))
            }
            const onUp = () => {
                document.body.classList.remove("select-none", "cursor-col-resize")
                setResizingColId(null)
                window.removeEventListener("pointermove", onMove)
                window.removeEventListener("pointerup", onUp)
                window.removeEventListener("pointercancel", onUp)
                activeResizeCleanupRef.current = null
            }
            activeResizeCleanupRef.current = onUp
            window.addEventListener("pointermove", onMove)
            window.addEventListener("pointerup", onUp)
            window.addEventListener("pointercancel", onUp)
        },
        [direction, table, onColumnSizingChangeInternal],
    )

    const headerGroup = table.getHeaderGroups()[0]
    const gridTemplateColumns = headerGroup
        ? gridTemplateFromHeaders(headerGroup.headers, columnSizing)
        : ""

    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 10,
    })

    const maxHeightStyle =
        typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight

    if (data.length === 0) {
        return (
            <div
                className={cn(
                    "flex min-h-32 items-center justify-center rounded-md px-4 text-sm",
                    className,
                )}
            >
                {emptyState ?? "No data"}
            </div>
        )
    }

    /**
     * The row's intrinsic minimum width: sum of each column's true floor
     * (see `columnMinWidth`) + column gaps (`gap-x-4`) + horizontal padding
     * (`px-3` × 2). Applied as `min-width: max(100%, …)` on header and body so
     * they share one scroll width. Using column FLOORS (not TanStack's 150px
     * placeholder for `fr` columns) means flexible tables shrink to fit their
     * container instead of forcing spurious horizontal scroll.
     */
    const colCount = headerGroup?.headers.length ?? 0
    const minTableOuterWidth =
        (headerGroup?.headers.reduce((sum, header) => sum + columnMinWidth(header, columnSizing), 0) ?? 0) +
        Math.max(0, colCount - 1) * 16 +
        24

    return (
        <div className={cn("flex min-w-0 flex-col", className)} role="grid">
            <div
                ref={parentRef}
                className={cn("min-h-0 overflow-auto", scrollAreaClassName)}
                style={{ maxHeight: maxHeightStyle }}
            >
                {headerGroup ? (
                    <div
                        className="bg-surface-gray-2 sticky top-0 z-10 mb-2 grid w-full items-center gap-x-4 rounded px-3 py-2"
                        role="row"
                        style={{
                            display: "grid",
                            gridTemplateColumns,
                            minWidth: `max(100%, ${minTableOuterWidth}px)`,
                            boxSizing: "border-box",
                        }}
                    >
                        {headerGroup.headers.map((header) => {
                            const meta = header.column.columnDef.meta as ListViewColumnMeta | undefined
                            const canSort = sortingEnabled && header.column.getCanSort()
                            const sorted = header.column.getIsSorted()
                            const label = header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())
                            return (
                                <div
                                    key={header.id}
                                    className={cn(
                                        "text-ink-gray-5 group relative flex min-w-0 items-center px-0 text-sm",
                                        alignClass(meta),
                                    )}
                                    role="columnheader"
                                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                                >
                                    {canSort ? (
                                        <button
                                            type="button"
                                            onClick={header.column.getToggleSortingHandler()}
                                            className="flex min-w-0 items-center gap-1 rounded transition-colors hover:text-ink-gray-7 focus-visible:focus-ring"
                                        >
                                            <span className="truncate leading-snug">{label}</span>
                                            {sorted === "asc" ? (
                                                <ArrowUpIcon className="size-3.5 shrink-0" />
                                            ) : sorted === "desc" ? (
                                                <ArrowDownIcon className="size-3.5 shrink-0" />
                                            ) : (
                                                <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
                                            )}
                                        </button>
                                    ) : (
                                        <div className="min-w-0 flex-1 truncate leading-snug">{label}</div>
                                    )}
                                    {enableColumnResizing && header.column.getCanResize() ? (
                                        <>
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    "pointer-events-none absolute ltr:-right-2 rtl:-left-2 z-1 w-0.5 bg-outline-gray-2",
                                                    "opacity-0 transition-[opacity,background-color] ease-in-out duration-150",
                                                    "group-hover:opacity-100 group-hover:bg-outline-gray-2",
                                                    resizingColId === header.column.id && "bg-outline-gray-3 opacity-100",
                                                )}
                                                style={{ height: "100%" }}
                                            />
                                            <div
                                                role="separator"
                                                aria-orientation="vertical"
                                                aria-label="Resize column"
                                                onPointerDown={(e) => startColumnResize(e, header)}
                                                className="absolute top-0 ltr:-right-2 rtl:-left-2 z-10 h-full w-2 max-w-[12px] cursor-col-resize touch-none select-none bg-transparent"
                                            />
                                        </>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                ) : null}

                <div
                    className="relative w-full"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        minWidth: `max(100%, ${minTableOuterWidth}px)`,
                        boxSizing: "border-box",
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index]
                        if (!row) return null
                        const leadDataColumnIndex = enableRowSelection ? 1 : 0
                        return (
                            <div
                                key={row.id}
                                data-index={virtualRow.index}
                                role="row"
                                className={cn(
                                    "absolute top-0 group ltr:left-0 rtl:right-0 w-full min-w-0 rounded px-3 transition-colors",
                                    // virtualRow.index > 0 && "border-t border-outline-gray-1",
                                    !row.getIsSelected() && "hover:bg-surface-gray-1",
                                    row.getIsSelected() && "bg-surface-gray-2 hover:bg-surface-gray-3",
                                    onRowClick && "cursor-pointer",
                                )}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns,
                                    boxSizing: "border-box",
                                    columnGap: "1rem",
                                    height: `${rowHeight}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                onClick={(e) => {
                                    if (onRowClick) onRowClick(row.original, e)
                                }}
                            >
                                {virtualRow.index > 0 && <div className="absolute top-0 inset-s-3 inset-e-3 h-px bg-outline-gray-1" />}
                                {row.getVisibleCells().map((cell, cellIndex) => {
                                    const meta = cell.column.columnDef.meta as ListViewColumnMeta | undefined
                                    return (
                                        <div
                                            key={cell.id}
                                            role="gridcell"
                                            className={cn(
                                                "flex min-w-0 items-center overflow-hidden text-sm",
                                                cellIndex === leadDataColumnIndex
                                                    ? "text-ink-gray-8"
                                                    : "text-ink-gray-7",
                                                alignClass(meta),
                                                tabularNumsClass(meta),
                                            )}
                                        >
                                            <ListViewCellBody cell={cell} row={row} meta={meta}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </ListViewCellBody>
                                        </div>
                                    )
                                })}


                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/**
 * Div-based list with CSS Grid columns, optional resize handles, row virtualization, and frappe-ui–aligned Espresso tokens.
 */
export function ListView<TData>(props: ListViewProps<TData>) {
    return <ListViewInner {...props} />
}

export type { ColumnSizingState, RowSelectionState, SortingState }
