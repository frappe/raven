import { Button } from "@components/ui/button"
import { SidebarPreview } from "./SidebarPreview"
import { useGroupedChannels, type ChannelSidebarData } from "@raven/lib/hooks/useGroupedChannels"
import { useChannels } from "@stores/channels/useChannelList"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { useMemo, useState } from "react"
import { ChannelTable } from "./ChannelTable"
import { RavenUser } from "@raven/types/Raven/RavenUser"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import _ from "@lib/translate"
import { useParams } from "react-router"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { WorkspaceSelect } from "@components/common/WorkspaceSelect"
import { SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle } from "@components/ui/settings-dialog"
import { errorResponseToast } from "@components/ui/error-banner"
import { ChannelGroupsProvider } from "./useChannelGroups"

export const CustomizeSidebarDialog = () => {

    const { channels } = useChannels()
    const { myProfile, mutate } = useCurrentRavenUser()

    const { updateDoc } = useFrappeUpdateDoc()


    const methods = useForm<RavenUser>({
        defaultValues: {
            ...myProfile
        }
    })
    const ravenUser = useWatch<RavenUser>({
        control: methods.control
    })
    const { workspaceID } = useParams()
    const { workspaces } = useWorkspaces()
    // Only workspaces the user is a MEMBER of: customizing organizes YOUR
    // sidebar, and a public workspace you haven't joined has no sidebar of
    // yours to organize.
    const memberWorkspaces = useMemo(
        () => workspaces.filter((workspace) => workspace.workspace_member_name),
        [workspaces],
    )
    // Routes like /saved-messages, /search or /threads carry no :workspaceID, so
    // fall back to the first member workspace and let the user switch. Without
    // this the grouping filters to workspace `undefined` and the dialog is empty.
    // The URL's workspace only wins when the user is a member of it (they may be
    // browsing a public workspace they haven't joined).
    const [pickedWorkspace, setPickedWorkspace] = useState<string | undefined>(undefined)
    const urlWorkspace = memberWorkspaces.some((workspace) => workspace.name === workspaceID) ? workspaceID : undefined
    const activeWorkspace = pickedWorkspace ?? urlWorkspace ?? memberWorkspaces[0]?.name ?? ''
    // The TABLE shows every channel, including ones the user's own sidebar
    // preferences hide (not joined / no recent activity) — you can't organize
    // a channel you can't see; hidden rows are greyed with an explanation.
    const channelSidebarData = useGroupedChannels(channels, ravenUser as RavenUser, activeWorkspace, { includeHidden: true })
    // The PREVIEW must keep hiding them — it shows the sidebar as it will
    // actually look after saving.
    const previewData = useMemo((): ChannelSidebarData => ({
        groupedChannels: channelSidebarData.groupedChannels
            .map(([group, groupChannels]): ChannelSidebarData["groupedChannels"][number] =>
                [group, groupChannels.filter((ch) => !ch._hiddenReason)])
            .filter(([, groupChannels]) => groupChannels.length > 0),
        ungroupedChannels: channelSidebarData.ungroupedChannels.filter((ch) => !ch._hiddenReason),
    }), [channelSidebarData])

    const { handleSubmit, reset, formState: { isDirty } } = methods

    const onSubmit = (data: RavenUser) => {
        if (myProfile) {
            updateDoc("Raven User", myProfile.name, {
                channel_groups: data.channel_groups,
                grouped_channels: data.grouped_channels,
                pinned_channels: data.pinned_channels,
            }).then(() => {
                // Rebase the form's baseline onto what we just saved. useForm captured
                // defaultValues once at mount, so without this isDirty stays true forever
                // after the first Save — leaving "Discard changes" on screen claiming
                // unsaved work, and reverting to the PRE-EDIT state if clicked.
                reset(data)
                toast.success(_("Sidebar updated"))
                mutate()
            }).catch((error) => {
                errorResponseToast(_("Failed to update sidebar"), error)
            })
        }
    }

    return (
        <FormProvider {...methods}>
            <ChannelGroupsProvider>
                <SettingsPanelHeader
                    actions={
                        <>
                            {/* Edits are form state until Save, and nothing else signals that
                            unsaved work exists — this is that signal, and the way out of it.
                            Outline, not solid: Save is the panel's one primary button. */}
                            {isDirty && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => reset()}
                                >
                                    {_("Discard changes")}
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSubmit(onSubmit)}
                            >
                                {_("Save")}
                            </Button>
                        </>}>
                    <SettingsPanelTitle>{_("Customize Sidebar")}</SettingsPanelTitle>
                    <SettingsPanelDescription>
                        {_("Customize your sidebar channels and groups")}
                    </SettingsPanelDescription>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4 pt-0.5">
                    {/* flex-1 min-h-0: fill the space between header and footer and DON'T grow
                    with content, so the table and preview columns get a bounded height and
                    scroll internally (otherwise the tall preview makes the whole panel scroll). */}
                    <div className="flex flex-1 min-h-0 w-full gap-4">
                        {/* Left Column - Customization */}
                        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-surface-base">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 pb-2">
                                <WorkspaceSelect
                                    value={activeWorkspace}
                                    onValueChange={setPickedWorkspace}
                                    className="w-full md:w-56"
                                    workspaces={memberWorkspaces}
                                />
                            </div>
                            <ChannelTable data={channelSidebarData} />
                        </div>
                        {/* Right Column - Preview (desktop only, so no mobile type/touch scaling) */}
                        <div className="hidden md:flex flex-none w-64 flex-col min-h-0 bg-surface-sidebar border border-outline-gray-2 rounded overflow-hidden">
                            <div className="px-4 py-3 border-b shrink-0">
                                <p className="text-sm-medium text-ink-gray-7">{_("Preview")}</p>
                            </div>
                            <SidebarPreview data={previewData} globalSort={ravenUser?.sort_channels_by} />
                        </div>
                    </div>
                </SettingsPanelContent>
            </ChannelGroupsProvider>
        </FormProvider>
    )
}