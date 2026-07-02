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
                "max-w-fit min-w-sm my-0.5 mt-1 bg-surface-elevation-1 border border-outline-gray-1 rounded-md p-3.5 flex flex-col gap-3",
                className
            )}
        >
            {children}
        </div>
    )
}

