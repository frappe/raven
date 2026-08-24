import { cn } from "@lib/utils"

export const StatContainer = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return <div className={cn("flex flex-col gap-1.5 p-2", className)}>{children}</div>
}

export const StatLabel = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return <span className={cn("text-tiny-medium text-ink-gray-6", className)}>{children}</span>
}

export const StatValue = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return <span className={cn("text-xl-semibold text-ink-gray-8 tabular-nums", className)}>{children}</span>
}