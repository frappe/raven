import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import _ from "@lib/translate"

interface TablePaginationProps {
    /** Current page index (0-based). */
    pageIndex: number
    /** Rows per page. */
    pageSize: number
    /** Total rows across all pages (from the server). */
    totalCount: number
    /** Navigate to a 0-based page index. */
    onPageChange: (pageIndex: number) => void
    /** Change the page size (resets to the first page). */
    onPageSizeChange: (pageSize: number) => void
    /** Selectable page sizes. Defaults to 10/20/50/100. */
    pageSizeOptions?: number[]
}

/**
 * Footer pagination controls for server-paginated tables (ListView / DataTable):
 * "showing X–Y of Z", a page-size selector, and prev/next. Espresso-tokened.
 */
export function TablePagination({
    pageIndex,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100],
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const canGoPrevious = pageIndex > 0
    const canGoNext = pageIndex < totalPages - 1

    const start = totalCount === 0 ? 0 : pageIndex * pageSize + 1
    const end = Math.min((pageIndex + 1) * pageSize, totalCount)

    return (
        <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-ink-gray-4">
                {_("Showing {0}-{1} of {2}", [String(start), String(end), String(totalCount)])}
            </p>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-gray-4">{_("Rows per page")}</span>
                    <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                        {/* text-sm: the trigger's own type step is 14px, which left the page
                            size a size larger than everything beside it — its own label and
                            the "Showing x-y of n" count are both 13px. */}
                        <SelectTrigger inputSize="sm" className="text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <span className="text-sm text-ink-gray-4">
                    {_("Page {0} of {1}", [String(pageIndex + 1), String(totalPages)])}
                </span>

                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        isIconButton
                        onClick={() => canGoPrevious && onPageChange(pageIndex - 1)}
                        disabled={!canGoPrevious}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                        <span className="sr-only">{_("Previous page")}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        isIconButton
                        onClick={() => canGoNext && onPageChange(pageIndex + 1)}
                        disabled={!canGoNext}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                        <span className="sr-only">{_("Next page")}</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default TablePagination
