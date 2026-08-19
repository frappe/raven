import { PageHeader } from "@components/layout/PageHeader"
import { Skeleton } from "@components/ui/skeleton"
import _ from "@lib/translate"

/**
 * Suspense fallback for the lazy ShareTarget page. This route is a COLD entry
 * (the OS share sheet) — the chunk is never warm — so the silhouette matters
 * more here than anywhere: without it the share sheet opened onto a blank
 * screen. Header is the real component; no tab bar (the page has none).
 */
export const ShareTargetSkeleton = () => (
    <div className="flex h-dvh flex-col overflow-hidden">
        <PageHeader title={_("Share to…")} />
        <div className="space-y-2 p-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="flex-1 overflow-hidden px-3">
            {Array.from({ length: 8 }).map((_ignored, index) => (
                <div key={index} className="flex h-12 items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 rounded-sm" style={{ width: `${35 + ((index * 17) % 30)}%` }} />
                </div>
            ))}
        </div>
    </div>
)
