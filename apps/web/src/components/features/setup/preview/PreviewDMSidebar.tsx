import { TreePalm } from "lucide-react"
import { generateAvatarColor, getInitials } from "@components/features/message/UserAvatar"
import { DMSidebarSkeleton } from "@components/dm-sidebar/DMSidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Skeleton } from "@components/ui/skeleton"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import type { PreviewModel, PreviewPerson } from "./model"

// More rows than the tallest preview fits; the rest are cut off at its bottom edge.
const MAX_PEOPLE = 30
const PLACEHOLDER_ROWS = 4

/** A conversation row laid out as the app's: avatar, then the name with the date beside it over the last message. */
const DMRow = ({ person, onLeave, delay }: { person: PreviewPerson; onLeave: boolean; delay: number }) => (
    // py-0.5: the app's row link, which spaces rows apart.
    <div className="py-0.5">
        <div className="flex w-full items-center gap-3 rounded px-2 py-2 text-sm animate-setup-item-in">
            <span className="relative shrink-0">
                {/* A blank invite row: who it is comes as it's typed. */}
                {person.name ? (
                    <Avatar className="size-8 rounded-full">
                        {person.image && <AvatarImage src={person.image} alt="" />}
                        <AvatarFallback className={cn("select-none border-0 text-sm font-medium", generateAvatarColor(person.name))}>
                            {getInitials(person.name)}
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <Skeleton className="size-8 rounded-full" />
                )}
                {/* Frappe HR: the app's on-leave badge. */}
                {onLeave && (
                    <span
                        className="absolute -end-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full border border-outline-base bg-surface-amber-2 animate-setup-item-in"
                        style={{ animationDelay: `${delay}ms` }}
                    >
                        <TreePalm className="size-2.5 text-ink-amber-8" />
                    </span>
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                    {person.name ? (
                        <span className="truncate leading-snug text-ink-gray-8">{person.name}</span>
                    ) : (
                        <Skeleton className="h-3 w-24" />
                    )}
                    <Skeleton className="h-3 w-12 shrink-0" />
                </div>
                {/* No conversation yet: the last message is still to come. */}
                <Skeleton className="mt-1.5 h-3 w-3/4" />
            </div>
        </div>
    </div>
)

/** The direct messages sidebar, opened from the rail: the team being added appears in it as conversations. */
export const PreviewDMSidebar = ({ model }: { model: PreviewModel }) => {
    const people = model.people.slice(0, MAX_PEOPLE)
    return (
        <div className="flex h-full w-(--sidebar-width) shrink-0 flex-col bg-surface-sidebar">
            <div className="flex shrink-0 items-center px-2 py-2">
                <span className="px-1 py-1 text-base font-medium text-ink-gray-8">{_("Direct Messages")}</span>
            </div>
            {/* The list runs on past the window's bottom edge, fading out over the last row's height. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-3.5rem),transparent)]">
                {people.map((person, index) => (
                    <DMRow
                        key={person.id}
                        person={person}
                        onLeave={model.leave && index % 2 === 0}
                        delay={index * 60}
                    />
                ))}
                {/* The rest of the list as the app shows it while loading. */}
                <DMSidebarSkeleton count={Math.max(0, PLACEHOLDER_ROWS - people.length)} />
            </div>
        </div>
    )
}
