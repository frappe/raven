import { ChevronDown, MoreVertical } from "lucide-react"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { buttonVariants } from "@components/ui/button"
import { Skeleton } from "@components/ui/skeleton"
import { ChannelSidebarSkeleton, channelRowClassName, channelRowLabelClassName } from "@components/channel-sidebar/ChannelSidebar"
import { cn } from "@lib/utils"
import type { SetupStepName } from "../steps"
import { hoverLook } from "./emphasis"
import type { PreviewModel } from "./model"

/** The workspace's sidebar: the switcher and channel options on top, then its channels. */
/** `finished`: setup is done and the app opens on this channel, so its row shows as the app's open one. */
export const PreviewChannelSidebar = ({ model, activeStep, finished = false }: { model: PreviewModel; activeStep: SetupStepName; finished?: boolean }) => (
    <div className="flex h-full w-(--sidebar-width) shrink-0 flex-col bg-surface-sidebar">
        {/* The workspace switcher and channel options, styled as the app's buttons but not clickable.
            The switcher gives way to a long name (buttons don't shrink by default), which truncates.
            Sized as the app's sidebar header (py-2, a transparent bottom border), so the rows land where the app's do. */}
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-transparent px-1 py-2">
            {model.workspace ? (
                <div className={cn(buttonVariants({ variant: "ghost", size: "md" }), "min-w-0 shrink justify-start cursor-default animate-setup-item-in", hoverLook(activeStep === "workspace"))}>
                    <Avatar key={model.workspace.logo ?? "letter"} className="size-5 shrink-0 rounded-sm">
                        {model.workspace.logo && <AvatarImage src={model.workspace.logo} alt="" />}
                        <AvatarFallback className="rounded-none bg-surface-gray-3 text-2xs text-ink-gray-5">
                            {model.workspace.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">{model.workspace.name}</span>
                    <ChevronDown className="size-4" />
                </div>
            ) : (
                <div className="flex h-8 items-center gap-2 px-2.5">
                    <Skeleton className="size-5 rounded-sm" />
                    <Skeleton className="h-3.5 w-24" />
                </div>
            )}
            <div className={cn(buttonVariants({ variant: "ghost", size: "sm", isIconButton: true }), "cursor-default text-ink-gray-5")}>
                <MoreVertical />
            </div>
        </div>
        {/* px-1 pt-1 and each row's pb-1: the app's list spacing. */}
        <div className="flex min-h-0 flex-1 flex-col px-1 pt-1">
            {model.channel && (
                <div className="pb-1">
                    <div
                        className={cn(
                            channelRowClassName({ isActive: finished, unread: false }),
                            "cursor-default animate-setup-item-in",
                            // The app's hover look while the step is open.
                            !finished && activeStep === "channel" && "bg-surface-gray-3",
                        )}
                    >
                        <ChannelIcon type={model.channel.type ?? "Public"} className="h-4 w-4 shrink-0" />
                        <span className={channelRowLabelClassName(false)}>{model.channel.name}</span>
                    </div>
                </div>
            )}
            {/* The rest of the list as the app shows it while loading. */}
            <ChannelSidebarSkeleton count={5} />
        </div>
    </div>
)
