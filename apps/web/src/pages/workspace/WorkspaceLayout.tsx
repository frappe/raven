import { Navigate, Outlet, useMatch, useParams } from 'react-router'
import { ChannelSidebar } from '@components/channel-sidebar/ChannelSidebar'
import AppMobileFooter from '@components/features/header/AppMobileFooter'
import { useIsMobile } from '@hooks/use-mobile'
import { useWorkspaces } from '@hooks/useWorkspaces'
import { cn } from '@lib/utils'

/**
 * Slack-style columns: a full-height channel sidebar beside the content
 * column, which is the gray "canvas" the chat/thread/drawer islands float on
 * (ChatContentView paints the islands; bare empty states sit on the canvas).
 *
 * Mobile uses STACKED navigation: the sidebar is the workspace page, and an open
 * channel renders as a full-screen layer ON TOP of it — the sidebar stays mounted
 * underneath. Going back (chevron or the iOS back-swipe) just removes the layer and
 * reveals the already-rendered list at the same scroll position. Unmounting the
 * sidebar instead meant every back-navigation rebuilt it, which flashed visibly
 * after the iOS swipe (the OS shows a snapshot during the gesture, then swaps to
 * the live page — any rebuild in that swap is a flash).
 */
const WorkspaceLayout = () => {
    const isMobile = useIsMobile()
    const { workspaceID } = useParams<{ workspaceID: string }>()
    const { workspaces, isLoading, error } = useWorkspaces()
    // The layout mounts above the `:id` route, so useParams can't see the
    // channel (params only include matches up to this depth) — match the
    // path instead; end: false keeps matching with a thread drawer open
    const channelMatch = useMatch({ path: '/:workspaceID/:id', end: false })
    const hasChannelOpen = Boolean(channelMatch)

    // The workspace no longer exists (deleted here or by another admin, or the
    // user was removed) — bounce to the index, which lands on a valid workspace.
    // Wait for the list so we don't redirect during the initial load — and only
    // trust an ABSENCE the fetch actually proved: a failed fetch also leaves an
    // empty list, and redirecting on that bounced users to a blank index on a
    // transient network error. Render the layout instead and let the list heal
    // (reconnect revalidation).
    const listTrustworthy = !isLoading && !(error && workspaces.length === 0)
    if (listTrustworthy && workspaceID && !workspaces.some((w) => w.name === workspaceID)) {
        return <Navigate to="/" replace />
    }

    return (
        // relative on the OUTER column: the mobile channel layer positions against the
        // whole column (list + footer), sliding over the tab bar like a native detail
        // page. The footer stays MOUNTED throughout — unmounting it resized the list
        // row, which clamped the list's scroll position whenever it sat at the bottom.
        <div className='relative flex flex-col h-full min-h-0 w-full'>
            <div className='flex min-h-0 flex-1'>
                <div
                    className='md:w-(--sidebar-width) w-full shrink-0 min-h-0'
                    // While covered by the channel layer on mobile, keep the sidebar out
                    // of the focus order / accessibility tree.
                    inert={isMobile && hasChannelOpen ? true : undefined}
                >
                    <ChannelSidebar />
                </div>

                {/* Mobile: a full-screen layer above the sidebar while a channel is open,
                    hidden when none is (it would just be an empty surface covering the
                    list). Covers the footer too (inset-0 of the outer column). Desktop:
                    a normal flex column beside the sidebar. */}
                <div
                    className={cn(
                        'flex min-w-0 min-h-0 flex-col bg-surface-sidebar',
                        'max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in',
                        !hasChannelOpen && 'max-md:hidden',
                        'md:flex-1',
                    )}
                >
                    <Outlet />
                </div>
            </div>

            <AppMobileFooter inert={isMobile && hasChannelOpen ? true : undefined} />
        </div>
    )
}

export default WorkspaceLayout
