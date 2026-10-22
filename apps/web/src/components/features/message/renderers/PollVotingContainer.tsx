import React from "react"
import { cn } from "@lib/utils"

export interface PollVotingContainerProps {
    children: React.ReactNode
    className?: string
}

export const PollVotingContainer: React.FC<PollVotingContainerProps> = ({
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                // The minimum width never exceeds the message column. A fixed 18rem ran past the
                // screen on narrow phones, and on Android when the system font size scales rem.
                "max-w-fit min-w-[min(var(--container-2xs),100%)] md:min-w-[min(var(--container-sm),100%)] my-0.5 mt-1 bg-surface-elevation-1 border border-outline-gray-1 rounded-md md:p-3.5 p-2.5 flex flex-col gap-3",
                className
            )}
        >
            {children}
        </div>
    )
}

