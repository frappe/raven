import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { Skeleton } from "@components/ui/skeleton"
import _ from "@lib/translate"

/**
 * Suspense fallback for the lazy Profile page — a silhouette of its layout.
 * Deliberately EAGER (lives in the main bundle) so it can paint while the
 * page's chunk loads.
 *
 * The header and the tab bar are the REAL components, not skeletons: both are
 * in the main bundle already (every eager page uses them), so during the
 * chunk load the screen keeps its frame and the tabs stay TAPPABLE — without
 * this, the whole screen went blank for the load (the footer lived inside the
 * still-loading chunk, and the fallback was null).
 */
export const ProfilePageSkeleton = () => (
    <div className="flex h-dvh flex-col overflow-hidden">
        <PageHeader title={_("Profile")} />
        <div className="flex-1 overflow-hidden p-2 space-y-4">
            {/* Identity card: avatar circle + name line, centered like the page. */}
            <div className="flex flex-col items-center gap-4 px-4 py-4">
                <Skeleton className="size-24 rounded-full" />
                <Skeleton className="h-7 w-40" />
            </div>
            {/* Settings rows. */}
            <div className="flex flex-col gap-1 px-1">
                {Array.from({ length: 5 }).map((_ignored, index) => (
                    <div key={index} className="flex h-12 items-center gap-3 px-3">
                        <Skeleton className="size-5 rounded-md" />
                        <Skeleton className="h-4 rounded-sm" style={{ width: `${30 + ((index * 13) % 25)}%` }} />
                    </div>
                ))}
            </div>
        </div>
        <AppMobileFooter />
    </div>
)
