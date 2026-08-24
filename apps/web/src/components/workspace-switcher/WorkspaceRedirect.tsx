import { Navigate, useParams } from "react-router-dom"
import { useMemo } from "react"
import { useAtomValue } from "jotai"
import { useIsMobile } from "@hooks/use-mobile"
import { useChannels } from "@stores/channels/useChannelList"
import { useGroupedChannels } from "@raven/lib/hooks/useGroupedChannels"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"

/**
 * Redirects a workspace's index route to a channel: the last channel visited in
 * THIS workspace if there is one, otherwise the first channel in the sidebar's
 * display order (Favorites → groups → ungrouped). No hardcoded "general" — that
 * channel may not exist in the workspace, and the first listed channel is what
 * the user expects when switching.
 */
export const WorkspaceRedirect = () => {
    const { workspaceID } = useParams<{ workspaceID: string }>()
    const isMobile = useIsMobile()
    const lastWorkspace = useAtomValue(lastWorkspaceAtom)
    const lastChannel = useAtomValue(lastChannelAtom)
    const { channels } = useChannels()
    const { myProfile } = useCurrentRavenUser()
    const { groupedChannels, ungroupedChannels } = useGroupedChannels(channels, myProfile, workspaceID)

    // First channel in the same display order the sidebar uses.
    const firstChannel = useMemo(
        () => [...groupedChannels.flatMap(([, group]) => group), ...ungroupedChannels][0]?.name,
        [groupedChannels, ungroupedChannels],
    )

    if (!workspaceID) {
        return <Navigate to="/" replace />
    }

    // On mobile the channel sidebar IS the workspace index page — don't
    // auto-open a channel over it (same as DirectMessagesIndex)
    if (isMobile) {
        return null
    }

    // Reuse the last channel only if it was visited in THIS workspace — channel
    // ids don't transfer across workspaces — AND it still exists in the loaded
    // list. A stale id (the channel was deleted, or access was lost) would
    // otherwise redirect straight into a dead route; while the list is still
    // loading this check simply fails and the empty-target guard below waits.
    // Archived channels deliberately PASS this check: they remain viewable,
    // so reopening one you were reading is fine.
    const lastStillExists = channels.some((channel) => channel.name === lastChannel)
    const lastInWorkspace = lastWorkspace === workspaceID && lastStillExists ? lastChannel : ""
    const target = lastInWorkspace || firstChannel

    // Nothing to open yet: still loading, or the workspace has no channels (the
    // sidebar shows its empty state). Either way, don't redirect to a 404.
    if (!target) {
        return null
    }

    return <Navigate to={`/${encodeURIComponent(workspaceID)}/${encodeURIComponent(target)}`} replace />
}
