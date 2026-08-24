import { cn } from "@lib/utils"

/**
 * A floating content card on the app's gray canvas — chat, thread, and the
 * channel/poll drawers each live in their own Island, separated by the
 * canvas gutter and gaps (no borders).
 *
 * Rounded + shadowed on desktop; full-bleed on mobile (no chrome, edge to
 * edge). Always a `min-h-0` flex column so a scroll container inside it (the
 * chat stream) keeps an unbroken height chain.
 */
export const Island = ({ children, className, inert }: { children: React.ReactNode; className?: string; inert?: boolean }) => (
    <div
        // inert: hosts set this while the island is covered by a mobile layer (e.g. the
        // channel under an open thread) to keep it out of focus/accessibility order.
        inert={inert}
        className={cn(
            // isolate: the island is its own stacking context, so z-indexes INSIDE it
            // (floating date pill, jump-to-present, …) can never paint above something
            // covering the island — like the mobile thread layer over the channel.
            "isolate flex min-h-0 min-w-0 flex-col overflow-clip bg-surface-base md:rounded-lg md:shadow-chat-area",
            className,
        )}
    >
        {children}
    </div>
)
