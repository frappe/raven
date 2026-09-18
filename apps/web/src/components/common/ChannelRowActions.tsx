import { useContext, useEffect, useState } from "react"
import { FrappeConfig, FrappeContext, useFrappeUpdateDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import { Bell, BellOff, Check, Folder, Link, MessageSquareDot, MoreVertical, Star, X, type LucideIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { errorResponseToast } from "@components/ui/error-banner"
import { channelStore } from "@stores/channels/store"
import { useChannelById } from "@stores/channels/useChannelList"
import { useChannelUnread } from "@stores/unread/useChannelUnread"
import { useMarkUnread } from "@stores/unread/useMarkUnread"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { assignChannelToGroup } from "@raven/lib/utils/channelGroups"
import type { RavenUser } from "@raven/types/Raven/RavenUser"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

type RowAction = {
    id: string
    label: string
    icon: LucideIcon
    onSelect: () => void
}

/** One assignable target in the group submenu — mirrors ChannelGroupSelect's options
 *  (Favorites, the user's groups, Clear when assigned), minus "New group". */
type GroupOption = {
    id: string
    label: string
    /** null = clear the assignment (ungroup/unpin). */
    target: string | null
    /** The channel's current assignment — rendered as a trailing check. */
    isCurrent: boolean
    /** Favorites gets the filled star, Clear gets the X; plain groups have no icon. */
    icon?: "star" | "clear"
}

/**
 * The channel-level actions for one sidebar row. Same { id, label, icon, onSelect }
 * shape as useMessageActions, so the dropdown and the sheet render identically from
 * one source; the group submenu is separate structured data (it nests).
 *
 * Order (user-specified): Move to group, Copy link, Mute, Mark as unread.
 * DM rows: Mute, Mark as unread.
 */
const useChannelRowActions = ({ channelID, isDM, workspaceID }: Pick<ChannelRowActionsProps, "channelID" | "isDM" | "workspaceID">) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const markUnread = useMarkUnread()
    const channel = useChannelById(channelID)
    const notificationsOff = channel?.allow_notifications === 0

    // Group/Favorites assignment lives on the Raven User doc (grouped_channels /
    // pinned_channels child tables) — the same rows the customize-sidebar dialog
    // edits, written here immediately (no Save step) through the shared, tested
    // assignChannelToGroup helper (pinned XOR grouped).
    const { myProfile, mutate: mutateUser } = useCurrentRavenUser()
    const { updateDoc } = useFrappeUpdateDoc()

    const isPinned = myProfile?.pinned_channels?.some((row) => row.channel_id === channelID) ?? false
    const currentGroup = myProfile?.grouped_channels?.find((row) => row.channel_id === channelID)?.channel_group

    const assignToGroup = (target: string | null) => {
        if (!myProfile) return
        const { grouped, pinned } = assignChannelToGroup(
            myProfile.grouped_channels ?? [],
            myProfile.pinned_channels ?? [],
            channelID,
            target,
        )
        updateDoc("Raven User", myProfile.name, {
            grouped_channels: grouped,
            pinned_channels: pinned,
        })
            .then((doc) => mutateUser({ message: doc as RavenUser }, { revalidate: false }))
            .catch((error) => errorResponseToast(_("Could not move channel"), error))
    }

    // Mirrors ChannelGroupSelect: Favorites first, then the user's groups (doc
    // order), then Clear — only when the channel is assigned somewhere. No
    // "New group" here; groups are created in the customize-sidebar dialog.
    const groupOptions: GroupOption[] = isDM
        ? []
        : [
              { id: "favorites", label: _("Favorites"), target: "Favorites", isCurrent: isPinned, icon: "star" as const },
              ...(myProfile?.channel_groups ?? []).map((group) => ({
                  id: group.name ?? group.group_name,
                  label: group.group_name,
                  target: group.group_name,
                  isCurrent: currentGroup === group.group_name,
              })),
              ...(isPinned || currentGroup
                  ? [{ id: "clear", label: _("Clear"), target: null, isCurrent: false, icon: "clear" as const }]
                  : []),
          ]

    // Channel rows only — a link to someone else's DM is useless to the recipient.
    const copyLink = () => {
        const base = import.meta.env.VITE_BASE_NAME ? `/${import.meta.env.VITE_BASE_NAME}` : ""
        const path = `/${encodeURIComponent(workspaceID ?? "")}/${encodeURIComponent(channelID)}`
        navigator.clipboard.writeText(`${window.location.origin}${base}${path}`)
        toast.success(_("Link copied"))
    }

    // TODO(unify-mute): "Mute" here flips `allow_notifications` (push) through the
    // SAME endpoint and member flag as the settings panel's bell dropdown — one
    // knob, two surfaces. The separate `muted` member flag (badge/bold/aggregate
    // suppression — see the notification-prefs TODO in ChannelSettingsTab) still
    // has no writer; when the notification pipeline work lands, fold both flags
    // into one user-facing "mute" so silencing a channel also quiets its badge.
    const toggleMute = () => {
        const member = channel?.member_id
        if (!member) return
        const next: 0 | 1 = notificationsOff ? 1 : 0
        // Deliberately NOT optimistic: the row's bell-off marker and the menu
        // label flip only once the server confirms, so the marker never shows
        // for a toggle that then fails.
        call.post("raven.api.notification.toggle_push_notification_for_channel", {
            member,
            allow_notifications: next,
        })
            .then(() => channelStore.patchChannel(channelID, { allow_notifications: next }))
            .catch((error) => {
                // Generic on purpose — this path serves channels and DM conversations.
                errorResponseToast(notificationsOff ? _("Could not unmute") : _("Could not mute"), error)
            })
    }

    // Unread/mute state lives on the user's Raven Channel Member row, so both
    // need one to exist. Mark-unread additionally works on Open channels with no
    // row yet (the backend auto-creates the watermark there — same rule as
    // track_channel_visit); for non-member Public/Private channels it would
    // silently no-op, and mute would throw — so neither is offered. An already
    // unread channel has nothing to mark either — the badge is already up.
    const { count: unreadCount } = useChannelUnread(channelID)
    const isMember = Boolean(channel?.member_id)
    const canMarkUnread = (isMember || channel?.type === "Open") && unreadCount === 0

    const channelType = channel?.type

    const actions: RowAction[] = isDM
        ? [
              // DM participants always have a member row, but keep the same gate as
              // channels — a stale store entry without member_id must not offer a
              // toggle the server will reject.
              ...(isMember
                  ? [{ id: "mute", label: notificationsOff ? _("Unmute conversation") : _("Mute conversation"), icon: notificationsOff ? Bell : BellOff, onSelect: toggleMute }]
                  : []),
              ...(canMarkUnread
                  ? [{ id: "mark-unread", label: _("Mark as unread"), icon: MessageSquareDot, onSelect: () => markUnread(channelID) }]
                  : []),
          ]
        : [
              { id: "copy-link", label: _("Copy link"), icon: Link, onSelect: copyLink },
              ...(isMember
                  ? [{ id: "mute", label: notificationsOff ? _("Unmute channel") : _("Mute channel"), icon: notificationsOff ? Bell : BellOff, onSelect: toggleMute }]
                  : []),
              ...(canMarkUnread
                  ? [{ id: "mark-unread", label: _("Mark as unread"), icon: MessageSquareDot, onSelect: () => markUnread(channelID) }]
                  : []),
          ]

    return { actions, groupOptions, assignToGroup, channelType }
}

/** The submenu/subview row for one group option: star for Favorites, X for Clear,
 *  trailing check on the channel's current assignment. */
const GroupOptionContent = ({ option }: { option: GroupOption }) => (
    <>
        {option.icon === "star" && <Star className="fill-yellow-400 stroke-yellow-400" />}
        {option.icon === "clear" && <X />}
        <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
        {option.isCurrent && <Check className="ml-auto shrink-0 text-ink-gray-8" />}
    </>
)

export type ChannelRowActionsProps = {
    channelID: string
    /** Sheet title — channel name or DM peer name. */
    channelName: string
    /** DM rows get the reduced set: Mute + Mark as unread. */
    isDM?: boolean
    /** For the channel-row copy-link URL; unused for DMs. */
    workspaceID?: string
    /** Mobile long-press sheet — owned by the row (which owns the long-press). */
    sheetOpen: boolean
    onSheetOpenChange: (open: boolean) => void
    /** Desktop dropdown open state — rows use it for meta-hide + the active look. */
    onMenuOpenChange?: (open: boolean) => void
}

/**
 * One sidebar row's actions, in both shells:
 *
 * Desktop — a hover/focus-revealed kebab rendered IN-FLOW in the unread
 * badge's slot (rows mount this component right after the badge), opening a
 * DropdownMenu with "Move to group" as a nested submenu. Per-row Radix
 * instances are fine here (unlike the message stream): Virtuoso mounts ~20-30
 * rows and a closed menu renders only its trigger. The kebab lives INSIDE the
 * row NavLink, so its events are stopped to keep the row from navigating.
 *
 * Mobile — a bottom sheet, opened by the row's long-press (the row owns the
 * gesture + open state; this renders the sheet). "Move to group" swaps the
 * sheet to the group list (a submenu has nowhere to fly out to on a phone).
 */
export const ChannelRowActions = ({
    channelID,
    channelName,
    isDM,
    workspaceID,
    sheetOpen,
    onSheetOpenChange,
    onMenuOpenChange,
}: ChannelRowActionsProps) => {
    const { actions, groupOptions, assignToGroup, channelType } = useChannelRowActions({ channelID, isDM, workspaceID })

    /** Mobile sheet view: the action list, or the pushed group list. */
    const [sheetView, setSheetView] = useState<"actions" | "groups">("actions")
    // Reset on OPEN, not close — resetting while the sheet slides out swaps the
    // content mid-animation and flashes the action list on the way down.
    useEffect(() => {
        if (sheetOpen) setSheetView("actions")
    }, [sheetOpen])

    // Portaled in the DOM but still inside the row NavLink in the React tree —
    // React bubbles synthetic events through portals along that tree, so an
    // unstopped click in any of these surfaces would also fire the row's
    // navigate handler (observed live). Applied to every portaled content.
    const stopBubbling = {
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    }

    // Nothing offerable (an unread DM loses its only action) — no kebab, no sheet,
    // rather than an affordance that opens an empty menu.
    if (actions.length === 0 && groupOptions.length === 0) return null

    return (
        <>
            {/* Desktop kebab + dropdown */}
            <DropdownMenu onOpenChange={onMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        isIconButton
                        aria-label={_("Channel options")}
                        className={cn(
                            // IN-FLOW in the unread badge's slot (rows mount this right
                            // after the badge), shown by swapping display on hover /
                            // focus / while open — never an absolute overlay, so a long
                            // name or the badge can't end up underneath it. Desktop
                            // only; mobile opens the sheet via long-press instead.
                            // Negative margins let the 24px box overhang into the row's
                            // own padding: layout height stays a text line (16px, no row
                            // growth on hover) and the visual insets equalize at 3px —
                            // above/below from the row's height, right from the row's
                            // 8px padding − the 5px overhang.
                            "hidden size-6 shrink-0 cursor-pointer -my-1 -mr-[5px]",
                            "focus-visible:flex data-[state=open]:flex md:group-hover/row:flex",
                        )}
                        // Inside a NavLink: opening the menu must not navigate.
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                        }}
                    >
                        <MoreVertical className="size-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48" {...stopBubbling}>
                    {groupOptions.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Folder />
                                <span>{_("Move to group")}</span>
                            </DropdownMenuSubTrigger>
                            {/* Its own portal — needs its own bubbling guards. */}
                            <DropdownMenuSubContent className="w-48" {...stopBubbling}>
                                {groupOptions.map((option, index) => (
                                    <div key={option.id} className="contents">
                                        {/* Separators mirror ChannelGroupSelect: after
                                            Favorites (when groups exist) and before Clear. */}
                                        {index > 0 && (option.id === "clear" || index === 1) && <DropdownMenuSeparator />}
                                        <DropdownMenuItem onSelect={() => assignToGroup(option.target)}>
                                            <GroupOptionContent option={option} />
                                        </DropdownMenuItem>
                                    </div>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {actions.map((action) => (
                        <DropdownMenuItem key={action.id} onSelect={action.onSelect}>
                            <action.icon />
                            <span>{action.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile long-press sheet (row owns the gesture; vaul portals this out of the NavLink) */}
            <Drawer open={sheetOpen} onOpenChange={onSheetOpenChange}>
                <DrawerContent onCloseAutoFocus={(event) => event.preventDefault()} {...stopBubbling}>
                    <DrawerTitle className="flex items-center gap-2 px-4 pb-2 pt-1 text-left text-2xl-semibold text-ink-gray-9">
                        {sheetView === "groups" ? (
                            _("Move to group")
                        ) : (
                            <>
                                {!isDM && <ChannelIcon type={channelType || "Public"} className="h-5 w-5 shrink-0" />}
                                <span className="truncate">{channelName}</span>
                            </>
                        )}
                    </DrawerTitle>
                    <div className="flex flex-col gap-1 p-3 pb-6">
                        {sheetView === "groups" ? (
                            groupOptions.map((option) => (
                                <Button
                                    key={option.id}
                                    variant="ghost"
                                    size="lg"
                                    theme="gray"
                                    className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                    onClick={() => {
                                        assignToGroup(option.target)
                                        onSheetOpenChange(false)
                                    }}
                                >
                                    <GroupOptionContent option={option} />
                                </Button>
                            ))
                        ) : (
                            <>
                                {groupOptions.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="lg"
                                        theme="gray"
                                        className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                        onClick={() => setSheetView("groups")}
                                    >
                                        <Folder />
                                        {_("Move to group")}
                                    </Button>
                                )}
                                {actions.map((action) => (
                                    <Button
                                        key={action.id}
                                        variant="ghost"
                                        size="lg"
                                        theme="gray"
                                        className="w-full justify-start gap-3 active:bg-surface-gray-2"
                                        onClick={() => {
                                            action.onSelect()
                                            onSheetOpenChange(false)
                                        }}
                                    >
                                        <action.icon />
                                        {action.label}
                                    </Button>
                                ))}
                            </>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
