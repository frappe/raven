import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { Skeleton } from "@components/ui/skeleton"

/**
 * Suspense fallback for the lazy list+pane pages (Search, Saved Messages) — a
 * silhouette of their shared split layout: list column (full width on mobile,
 * ~45% on desktop) with header, search slot and message-shaped rows, an empty
 * right pane on desktop, and the tab bar on mobile.
 *
 * Deliberately EAGER, and the header + tab bar are the REAL components (both
 * already live in the main bundle): while the page's chunk loads, the screen
 * keeps its frame and the tabs stay tappable — a null fallback blanked the
 * whole screen, footer included, because the footer lives inside the chunk.
 */
export const ListPageSkeleton = ({ title }: { title: string }) => (
    <div className="relative flex flex-col h-dvh overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-col min-w-0 w-full md:w-[45%] md:max-w-[50%] md:shrink-0 bg-surface-base md:bg-surface-sidebar">
                <PageHeader title={title} />
                <div className="shrink-0 p-2">
                    <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <MessageListSkeleton />
                </div>
            </div>
            <div className="hidden md:flex flex-1 bg-surface-base" />
        </div>
        <AppMobileFooter />
    </div>
)
