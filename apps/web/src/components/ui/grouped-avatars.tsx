import { useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { cn } from "@lib/utils"

export interface User {
    name: string
    full_name: string
    user_image?: string
}

interface GroupedAvatarsProps {
    users: User[]
    max?: number
    size?: "xs" | "sm" | "md" | "lg"
    className?: string
    borderColorClass?: string
}

export function GroupedAvatars({
    users,
    max = 3,
    size = "md",
    className,
    borderColorClass = "border-surface-base",
}: GroupedAvatarsProps) {

    const totalUsers = users.length

    // This is a decorative preview, so prefer the avatars that actually show a
    // face: fill the visible slots with image-bearing users first, falling back
    // to initials-only avatars only when there aren't enough. Stable within
    // each group (original order otherwise preserved). The "+N" count is
    // unaffected — it's always total - max, regardless of who's shown.
    const visibleUsers = useMemo(() => {
        const withImage = users.filter((user) => user.user_image)
        const withoutImage = users.filter((user) => !user.user_image)
        return [...withImage, ...withoutImage].slice(0, max)
    }, [users, max])

    const remainingUsers = totalUsers - max > 0 ? Math.min(totalUsers - max, 9) : 0

    const sizeClasses = {
        xs: "h-6 w-6 text-xs",
        sm: "h-7 w-7 text-xs",
        md: "h-9 w-9 text-sm",
        lg: "h-11 w-11 text-base",
    }

    return (
        <div className={cn("flex -space-x-2", className)}>
            {visibleUsers.map((user) => (
                <Avatar
                    key={user.name}
                    className={cn(
                        sizeClasses[size],
                        "border-2 ring-0 rounded-full",
                        borderColorClass,
                    )}
                >
                    <AvatarImage src={user.user_image} alt={user.full_name} />
                    <AvatarFallback>
                        {user.full_name.charAt(0).toLocaleUpperCase()}
                    </AvatarFallback>
                </Avatar>
            ))}

            {remainingUsers > 0 && (
                <Avatar
                    className={cn(
                        sizeClasses[size],
                        "border-2 bg-surface-gray-2 text-ink-gray-5 ring-0 rounded-full text-xs",
                        borderColorClass,
                    )}
                >
                    <AvatarFallback>{remainingUsers}+</AvatarFallback>
                </Avatar>
            )}
        </div>
    )
}
