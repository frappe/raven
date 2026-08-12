import { BotIcon, Loader2, PhoneIcon, UserX } from "lucide-react"
import { useUser } from "@hooks/useUser"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useCreateDM } from "@hooks/useCreateDM"
import { useIsMobile } from "@hooks/use-mobile"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { OnLeaveBadge } from "@components/common/OnLeaveBadge"
import { UserAvatar, getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * The profile hover card shared by everything that names a user in the stream
 * (mentions, the sender name in a message header). One component so the card
 * a user gets is the same wherever they hover a person.
 *
 * `children` is the trigger (rendered via asChild — pass a single element).
 */
export const UserProfileHoverCard = ({
    id,
    fallbackLabel,
    children,
}: {
    id: string
    /** Shown while the user record is loading / for unknown users. */
    fallbackLabel?: string
    children: React.ReactNode
}) => {
    const { name: currentUser } = useUserCookieData()
    const isMobile = useIsMobile()
    const isSelf = !!id && id === currentUser

    // Content is portaled and only mounts while open (in either branch), so the
    // DM-create hook inside the card never runs for the many names nobody opens.
    const card = <UserProfileCard id={id} fallbackLabel={fallbackLabel ?? id} isSelf={isSelf} />

    // Hover has no touch equivalent, so mobile TAPS open the same card in a
    // Popover — the same split SystemMessage uses for its "N others" roster.
    if (isMobile) {
        return (
            <Popover>
                <PopoverTrigger asChild>{children}</PopoverTrigger>
                <PopoverContent align="start" className="min-w-72">
                    {card}
                </PopoverContent>
            </Popover>
        )
    }

    return (
        <HoverCard openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="min-w-72">{card}</HoverCardContent>
        </HoverCard>
    )
}

/** Profile card body — mounted lazily by the hover card (see note above). */
const UserProfileCard = ({ id, fallbackLabel, isSelf }: { id: string; fallbackLabel: string; isSelf: boolean }) => {
    const user = useUser(id)
    const { createDM, loading } = useCreateDM()

    const fullName = user?.full_name || fallbackLabel
    const availability = user?.availability_status
    const isBot = user?.type === "Bot"

    const hasStatus = (availability && availability !== "Invisible") || !!user?.custom_status

    return (
        <div className="flex flex-col gap-3">
            {/* Header: avatar + name + handle, as one tight identity block. */}
            <div className="flex items-center gap-3">
                <div>
                    {user ? (
                        <UserAvatar user={user} size="lg" showStatusIndicator />
                    ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-gray-2 text-base font-medium text-ink-gray-5">
                            {fullName.slice(0, 1).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-ink-gray-8 text-base-semibold">{fullName}</span>
                    </div>
                    <span className="truncate text-xs text-ink-gray-5">{id}</span>
                    <div className="flex items-center gap-1 py-0.5">
                        {isBot && (
                            <Badge variant="subtle" theme="violet">
                                <BotIcon />
                                {_("Bot")}
                            </Badge>
                        )}
                        {user?.enabled === 0 && (
                            <Badge variant="subtle">
                                <UserX />
                                {_("Disabled")}
                            </Badge>
                        )}
                        <OnLeaveBadge userID={id} />
                    </div>
                </div>
            </div>

            {/* Availability + custom status — its own section so it's clearly
                separated from the identity block (availability hidden when Invisible). */}
            {hasStatus && (
                <div className="flex flex-col gap-1">
                    {availability && availability !== "Invisible" && (
                        <span className="flex items-center gap-1.5 text-xs text-ink-gray-6">
                            <span className={cn("size-2 rounded-full", getStatusIndicatorColor(availability))} />
                            {availability}
                        </span>
                    )}
                    {user?.custom_status && <p className="text-p-sm text-ink-gray-7">{user.custom_status}</p>}
                </div>
            )}

            {/* Phone, when the profile has one — a tel: link, so on mobile
                (where this card opens by tap) it dials directly. */}
            {user?.contact_number && (
                <a
                    href={`tel:${user.contact_number}`}
                    className="flex items-center gap-1.5 text-xs text-ink-gray-6 hover:text-ink-gray-8"
                >
                    <PhoneIcon className="size-3.5 shrink-0" />
                    {user.contact_number}
                </a>
            )}

            {!isSelf && user?.enabled !== 0 && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => createDM(id)} disabled={loading}>
                    {loading && <Loader2 className="animate-spin" />}
                    {_("Message")}
                </Button>
            )}
        </div>
    )
}
