import { Skeleton } from "@components/ui/skeleton"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"

/**
 * The permalink page's silhouette (sidebar + chat stream). Lives in its own tiny
 * EAGER module so it can serve as both the Suspense fallback for the lazy page
 * chunk AND the page's own resolving state — one continuous skeleton from click
 * to destination, instead of blank → skeleton → page.
 */
export const MessagePermalinkSkeleton = () => (
    <div className="flex h-full w-full">
        {/* Channel sidebar (desktop only — mobile lands straight on the chat) */}
        <div className="hidden w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-outline-gray-2 bg-surface-sidebar px-2 py-3 md:flex">
            <Skeleton className="mb-3 h-6 w-36" />
            {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="flex h-7 items-center gap-2 px-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm" style={{ width: `${45 + ((index * 17) % 40)}%` }} />
                </div>
            ))}
        </div>
        {/* Chat: header bar + message rows */}
        <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center border-b border-outline-gray-2 px-4">
                <Skeleton className="h-4 w-40" />
            </div>
            <MessageListSkeleton />
        </div>
    </div>
)
