import { Outlet, Navigate, useMatch } from "react-router-dom"
import { DMSidebar } from "@components/dm-sidebar/DMSidebar"
import { useDMChannels } from "@stores/channels/useChannelList"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import AppMobileFooter from "@components/features/header/AppMobileFooter"


export function DirectMessagesEmptyState() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>{_("Select a conversation")}</EmptyTitle>
                <EmptyDescription>
                    {_("Choose a direct message from the sidebar to start chatting.")}
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

export function DirectMessagesIndex() {
    const { dmChannels, isLoading } = useDMChannels()
    const isMobile = useIsMobile()

    if (isMobile) return null

    if (isLoading) return null

    const firstDM = dmChannels[0]
    if (firstDM) {
        return <Navigate to={`/dm-channel/${encodeURIComponent(firstDM.name)}`} replace />
    }

    return <DirectMessagesEmptyState />
}

export default function DirectMessages() {
    const isMobile = useIsMobile()

    // This layout mounts above the `:id` route — useParams here only sees
    // params matched up to this depth, so `id` was always undefined and the
    // mobile sidebar never hid. Match the path instead (end: false keeps
    // matching while a thread extends the URL).
    const id = useMatch({ path: "/dm-channel/:id", end: false })?.params.id

    // Mobile is STACKED navigation (same as WorkspaceLayout): the DM list is the page,
    // and an open DM renders as a full-screen layer on top of it. The list stays mounted
    // underneath, so going back — chevron or iOS back-swipe — reveals it instantly at the
    // same scroll position instead of rebuilding it (which flashed after the swipe).
    // relative on the OUTER column: the mobile DM layer covers list + footer, sliding
    // over the tab bar like a native detail page. The footer stays MOUNTED — unmounting
    // it resized the list row, which clamped the list's scroll position at the bottom.
    return <div className="relative flex flex-col h-full min-h-0 w-full">
        <div className="flex min-h-0 flex-1">
            <div
                className="md:w-(--dm-sidebar-width) w-full shrink-0 min-h-0"
                // While covered on mobile, keep the list out of focus / accessibility order.
                inert={isMobile && !!id ? true : undefined}
            >
                <DMSidebar />
            </div>
            {/* Mobile: full-screen layer above the list while a DM is open, hidden when
                none is. Covers the footer too (inset-0 of the outer column). Desktop:
                a normal flex column beside the list. */}
            <div className={cn(
                "flex min-w-0 min-h-0 flex-col bg-surface-gray-1",
                "max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in",
                !id && "max-md:hidden",
                "md:flex-1",
            )}>
                <Outlet />
            </div>
        </div>
        <AppMobileFooter inert={isMobile && !!id ? true : undefined} />
    </div>
}
