import { cn } from "@lib/utils"

/** The rail's mark for the current item: a bar on its left edge, as the app draws it. */
export const RailItem = ({ active, children }: { active: boolean; children: React.ReactNode }) => (
    <div className="relative flex w-full justify-center">
        <div
            className={cn(
                "absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full transition-colors duration-200 motion-reduce:transition-none",
                active ? "bg-surface-gray-7" : "bg-transparent",
            )}
        />
        {children}
    </div>
)
