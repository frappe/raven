import { Skeleton } from "@components/ui/skeleton"

/**
 * Skeleton loading state for the Direct Message page (conversation view).
 * Matches layout: header (avatar + name + actions), message list, input area.
 */
export function DirectMessagePageSkeleton() {
    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header bar – matches DMChannelHeader height/positioning */}
            <div
                className="flex items-center justify-between gap-2 border-b bg-surface-base py-1.5 px-2 shrink-0"
                style={{
                    marginTop: "var(--app-header-height, 36px)",
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Skeleton className="h-7 w-7 shrink-0" />
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex items-center gap-1">
                    <Skeleton className="h-7 w-7" />
                    <Skeleton className="h-7 w-7" />
                    <Skeleton className="h-7 w-7" />
                </div>
            </div>

            {/* Message area */}
            <div
                className="flex-1 min-h-0 overflow-hidden flex flex-col"
                style={{ paddingTop: "36px" }}
            >
                <div className="flex-1 p-4 space-y-4 max-w-3xl">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-3.5 w-20" />
                                    <Skeleton className="h-3 w-14" />
                                </div>
                                <Skeleton
                                    className="h-4"
                                    style={{ width: `${45 + (i % 4) * 15}%` }}
                                />
                                {i % 2 === 0 && (
                                    <Skeleton
                                        className="h-4"
                                        style={{ width: "70%" }}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input area */}
                <div className="border-t border-outline-gray-2 p-2 shrink-0">
                    <div className="flex items-end gap-2 rounded-lg border bg-surface-base px-3 py-2">
                        <Skeleton className="h-5 flex-1 max-w-md" />
                        <Skeleton className="h-8 w-8 shrink-0" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * Skeleton rows for the message list only (use when header is already visible and messages are loading).
 */
export function MessageListSkeleton() {
    return (
        <div className="flex w-full flex-1 flex-col lg:mx-auto p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-3 w-14" />
                        </div>
                        <Skeleton
                            className="h-4"
                            style={{ width: `${45 + (i % 4) * 15}%` }}
                        />
                        {i % 2 === 0 && (
                            <Skeleton className="h-4" style={{ width: "70%" }} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
