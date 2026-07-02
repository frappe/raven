import { memo, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@components/ui/avatar'
import { cn } from '@lib/utils'
import { UserData } from "@db"
import { BotIcon, TreePalm } from 'lucide-react'
import { useIsUserOnline } from '@stores/presence/useUserPresence'
import { useIsUserOnLeave } from '@hooks/useIsUserOnLeave'
import _ from '@lib/translate'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface UserAvatarProps {
    user: UserData,
    size?: AvatarSize,
    className?: string,
    showStatusIndicator?: boolean,
    showBotIndicator?: boolean,
    addColoredFallback?: boolean,
    avatarClassName?: string,
}

const getInitials = (name: string): string => {
    return name.charAt(0).toLocaleUpperCase()
}

const generateAvatarColor = (name: string): string => {

    const sampleColors = [
        "bg-surface-green-2 text-ink-green-8",
        "bg-surface-amber-2 text-ink-amber-8",
        "bg-surface-red-2 text-ink-red-8",
        "bg-surface-blue-2 text-ink-blue-8",
        "bg-surface-violet-2 text-ink-violet-8",
        "bg-surface-cyan-2 text-ink-cyan-8",
        "bg-surface-gray-2 text-ink-gray-8",
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return sampleColors[hue % sampleColors.length]
}

export const getStatusIndicatorColor = (status: string) => {
    switch (status) {
        case 'Available':
            return 'bg-surface-green-6'
        case 'Away':
            return 'bg-surface-amber-6'
        case 'Do not disturb':
            return 'bg-surface-red-6'
        case 'Invisible':
            return 'bg-surface-gray-6'
        default:
            return 'bg-surface-green-6'
    }
}

const getSizeClasses = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    switch (size) {
        case 'xs':
            return {
                avatar: 'h-5 w-5 rounded-full',
                indicator: 'h-2 w-2 -bottom-0.5 -right-0.5 border',
                manualAvailableDot: 'h-0.5 w-0.5',
                bot: 'h-1.5 w-1.5',
                botContainer: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
                font: '!text-[8px] font-bold'
            }
        case 'sm':
            return {
                avatar: 'h-6 w-6 rounded-full',
                indicator: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
                manualAvailableDot: 'h-0.5 w-0.5',
                bot: 'h-2 w-2 size-2',
                botContainer: 'h-3 w-3 -bottom-0.5 -right-0.5',
                font: 'text-[10px]'
            }
        case 'md':
            return {
                avatar: 'h-8 w-8 rounded-full',
                indicator: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
                manualAvailableDot: 'h-0.75 w-0.75',
                bot: 'h-2.5 w-2.5',
                botContainer: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5',
                font: 'text-sm'
            }
        case 'lg':
            return {
                avatar: 'h-12 w-12 rounded-full',
                indicator: 'h-4 w-4 -bottom-0.5 -right-0.5',
                manualAvailableDot: 'h-1 w-1',
                bot: 'h-3 w-3',
                botContainer: 'h-4 w-4 -bottom-1 -right-1',
                font: 'text-base'
            }
        case 'xl':
            return {
                avatar: 'h-16 w-16 rounded-full',
                indicator: 'h-4 w-4 -bottom-0 right-0 border-2 border-outline-base',
                manualAvailableDot: 'h-2 w-2',
                bot: 'h-4 w-4',
                botContainer: 'h-7 w-7 -bottom-1 -right-1 border-2 border-outline-base',
                font: 'text-3xl font-semibold',
            }
    }
}

/**
 * Online/availability dot. Split out so it — and the per-user presence
 * subscription it makes (useIsUserOnline) — only mount when the indicator is
 * actually shown. Avatars rendered with showStatusIndicator={false} (member
 * lists, search results, etc.) never subscribe and never re-render on presence
 * changes. Combines live online presence with the user's manual availability:
 * Invisible or (offline + no status) shows nothing.
 */
const StatusIndicator = memo<{ user: UserData; size: AvatarSize }>(({ user, size }) => {
    const isOnline = useIsUserOnline(user.name)
    const isOnLeave = useIsUserOnLeave(user.name)
    const availabilityStatus = user.availability_status
    const sizeClasses = getSizeClasses(size)

    // On leave takes precedence over the online/availability dot — the user's vacation
    // icon (same easter-egg pick as OnLeaveBadge) in an amber badge, sized like the bot
    // badge so the icon is legible.
    if (isOnLeave) {
        return (
            <span
                className={cn(
                    "absolute flex items-center justify-center rounded-full border border-outline-base bg-surface-amber-2",
                    sizeClasses.botContainer,
                )}
                aria-label={_("On leave")}
                role="img"
                title={_("On leave")}
            >
                <TreePalm className={cn("text-ink-amber-8", sizeClasses.bot)} aria-hidden="true" />
            </span>
        )
    }

    if (availabilityStatus === 'Invisible') return null
    if (!availabilityStatus && !isOnline) return null

    const statusLabel = availabilityStatus || (isOnline ? _('Online') : _('Offline'))
    // "Available" but not actually online → hollow ring, distinct from solid live green
    const showManualAvailableDot = availabilityStatus === 'Available' && !isOnline

    return (
        <span
            className={cn(
                "absolute flex items-center justify-center rounded-full border-2 border-outline-base",
                sizeClasses.indicator,
                availabilityStatus ? getStatusIndicatorColor(availabilityStatus) : 'bg-surface-green-6',
            )}
            aria-label={statusLabel}
            role="img"
        >
            {showManualAvailableDot && (
                <span
                    className={cn("rounded-full bg-surface-base", sizeClasses.manualAvailableDot)}
                    aria-hidden="true"
                />
            )}
        </span>
    )
})

StatusIndicator.displayName = 'StatusIndicator'

export const UserAvatar = memo<UserAvatarProps>(({
    user,
    size = 'md',
    className,
    showStatusIndicator = true,
    showBotIndicator = true,
    addColoredFallback = true,
    avatarClassName,
}) => {
    const displayName = user.full_name || user.name
    const isBot = user.type === 'Bot'
    const sizeClasses = getSizeClasses(size)

    const avatarColor = useMemo(() => addColoredFallback ? generateAvatarColor(displayName) : 'bg-surface-gray-2 text-ink-gray-9', [displayName, addColoredFallback])

    return (
        <div className={cn("relative inline-block", className)}>
            <Avatar className={cn(sizeClasses.avatar, avatarClassName)}>
                <AvatarImage
                    src={user.user_image}
                    alt={`${displayName}'s profile picture`}
                    loading="lazy"
                />
                <AvatarFallback
                    className={cn("font-medium select-none border-0", avatarColor, sizeClasses.font)}
                    // style={fallbackStyle}
                    aria-label={`${displayName} (initials)`}
                >
                    {getInitials(displayName)}
                </AvatarFallback>
            </Avatar>

            {/* Status Indicator — only mounted (and only subscribes to presence) when wanted */}
            {showStatusIndicator && <StatusIndicator user={user} size={size} />}

            {/* Bot Indicator */}
            {isBot && showBotIndicator && (
                <span
                    className={cn(
                        "absolute flex items-center justify-center rounded-full bg-surface-base border border-outline-gray-1",
                        sizeClasses.botContainer
                    )}
                    aria-label="Bot account"
                    role="img">
                    <BotIcon
                        className={cn("text-ink-gray-8", sizeClasses.bot)}
                        aria-hidden="true"
                    />
                </span>
            )}
        </div>
    )
})

UserAvatar.displayName = 'UserAvatar'
