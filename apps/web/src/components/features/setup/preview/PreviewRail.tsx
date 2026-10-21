import { BellIcon, BookmarkIcon, MessageSquareTextIcon, SearchIcon, UsersIcon } from "lucide-react"
import { getInitials } from "@components/features/message/UserAvatar"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Separator } from "@components/ui/separator"
import { Skeleton } from "@components/ui/skeleton"
import { cn } from "@lib/utils"
import type { PreviewModel } from "./model"
import { RailItem } from "./RailItem"

/** A rail icon as the app draws it, without the link; the open one is pressed and marked. */
const RailIcon = ({ active = false, children }: { active?: boolean; children: React.ReactNode }) => (
    <RailItem active={active}>
        <div
            className={cn(
                "flex size-8 items-center justify-center rounded text-ink-gray-8 transition-colors duration-200 motion-reduce:transition-none [&>svg]:size-4",
                active ? "bg-surface-gray-4" : "bg-surface-gray-2",
            )}
        >
            {children}
        </div>
    </RailItem>
)

const RailSeparator = () => (
    <div className="w-full px-3.5">
        <Separator />
    </div>
)

/** The app's left rail, in its order: logo, nav icons, workspaces; "later" and the user's avatar at the bottom. */
export const PreviewRail = ({ model, dmsOpen }: { model: PreviewModel; dmsOpen: boolean }) => (
    <div className="flex h-full w-(--primary-sidebar-width) shrink-0 flex-col items-center justify-between border-e border-outline-gray-2 bg-surface-sidebar pt-2.5 pb-4">
        <div className="flex w-full flex-col items-center gap-3">
            <img src="/assets/raven/raven_logo.svg" alt="" className="size-8" />
            <RailSeparator />
            <RailIcon><SearchIcon /></RailIcon>
            <RailIcon><BellIcon /></RailIcon>
            <RailIcon active={dmsOpen}><UsersIcon /></RailIcon>
            <RailIcon><MessageSquareTextIcon /></RailIcon>
            <RailSeparator />
            {model.workspace ? (
                <RailItem active={!dmsOpen}>
                    <Avatar key={model.workspace.logo ?? "letter"} className="size-8 rounded animate-setup-item-in">
                        {model.workspace.logo && <AvatarImage src={model.workspace.logo} alt="" />}
                        <AvatarFallback className="rounded bg-surface-gray-2 text-xs text-ink-gray-7">
                            {model.workspace.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </RailItem>
            ) : (
                <Skeleton className="size-8 rounded" />
            )}
        </div>
        <div className="flex w-full flex-col items-center gap-3">
            <RailSeparator />
            <RailIcon><BookmarkIcon /></RailIcon>
            {model.profile ? (
                // Round with the "available" dot, as the app's profile button; hovered while the profile step is open.
                <div className="relative">
                    <Avatar key={model.profile.image ?? "initials"} className="size-8 rounded-full animate-setup-item-in">
                        {model.profile.image && <AvatarImage src={model.profile.image} alt="" />}
                        <AvatarFallback className="bg-surface-gray-2 text-sm font-medium text-ink-gray-9">{getInitials(model.profile.name)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute end-0 bottom-0 size-2.5 rounded-full border-2 border-outline-base bg-surface-green-6" />
                </div>
            ) : (
                <Skeleton className="size-8 rounded-full" />
            )}
        </div>
    </div>
)
