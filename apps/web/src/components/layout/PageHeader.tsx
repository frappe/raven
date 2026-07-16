import { cn } from "@lib/utils"

interface PageHeaderProps {
    /** Already-translated title (pass `_("…")`). */
    title: string
    /** Optional trailing content next to the title — a badge, count, or actions. */
    children?: React.ReactNode
    className?: string
}

/**
 * The thin title strip shared by the sidebar-less full-page lists (search, saved
 * messages, notifications). On mobile it's a fixed `h-11` bar with a bottom border;
 * on desktop it sheds the border and sizes to content.
 */
export function PageHeader({ title, children, className }: PageHeaderProps) {
    return (
        <div className={cn(
            "flex h-11 md:h-auto shrink-0 items-center gap-2 border-b md:border-b-0 px-2 py-2",
            className
        )}>
            <span className="px-1 py-1 md:text-base-medium text-xl-medium text-ink-gray-8">{title}</span>
            {children}
        </div>
    )
}
