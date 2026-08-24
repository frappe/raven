import { Skeleton } from "@components/ui/skeleton"
import { useIsMobile } from "@hooks/use-mobile"
import { AppMobileFooterSkeleton } from "../header/AppMobileFooter"


const BOTTOM_TAB_ICON_CLASS = "size-6 text-ink-gray-5"
/**
 * Simple skeleton loading state for the App Shell
 */
export function MainPageSkeleton() {

    const isMobile = useIsMobile()

    if (isMobile) {
        return <div className="flex flex-col justify-between h-screen">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="h-(--app-header-height) border-b border-outline-gray-2 px-6 flex items-center">
                    <Skeleton className="h-5 w-48" />
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-6">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Show the bottom tabs */}
            <AppMobileFooterSkeleton />
        </div>
    }

    return (
        <div className="flex h-screen">
            {/* Workspace Switcher Skeleton - Left narrow bar */}
            <div className="w-[60px] border-r border-outline-gray-2 bg-surface-sidebar flex flex-col items-center gap-4 py-6">
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
            </div>

            {/* Channel Sidebar Skeleton */}
            <div className="w-[280px] border-r border-outline-gray-2 bg-surface-sidebar flex flex-col">
                {/* Sidebar Header */}
                <div className="h-(--app-header-height) border-b border-outline-gray-2 px-4 flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>

                {/* Channel List */}
                <div className="flex-1 overflow-y-auto px-3 py-4">
                    {/* Channels header */}
                    <div className="flex items-center justify-between mb-4">
                        <Skeleton className="h-3 w-16" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </div>
                    </div>

                    {/* Channel groups */}
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="mb-6 last:mb-0">
                            {/* Group header */}
                            <div className="mb-3">
                                <Skeleton className="h-4 w-28" />
                            </div>
                            {/* Group channels */}
                            <div className="ml-3 space-y-2">
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <div key={j} className="flex items-center gap-2">
                                        <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
                                        <Skeleton className="h-3.5 flex-1" style={{ width: `${Math.floor(Math.random() * 30) + 60}%` } as React.CSSProperties} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Ungrouped channels */}
                    <div className="mt-6 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
                                <Skeleton className="h-3.5 flex-1" style={{ width: `${Math.floor(Math.random() * 30) + 60}%` } as React.CSSProperties} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="h-(--app-header-height) border-b border-outline-gray-2 px-6 flex items-center">
                    <Skeleton className="h-5 w-48" />
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
