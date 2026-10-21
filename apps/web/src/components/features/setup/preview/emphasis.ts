import { cn } from "@lib/utils"

/** A sidebar item the open step is changing looks hovered, as in the app; the rest look as they do at rest. */
export const hoverLook = (active: boolean) =>
    cn(
        "rounded transition-colors duration-200 motion-reduce:transition-none",
        active ? "bg-surface-gray-3 text-ink-gray-8" : "text-ink-gray-7",
    )
