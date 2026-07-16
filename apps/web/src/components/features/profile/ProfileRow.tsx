import { forwardRef } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@lib/utils"

interface ProfileRowProps extends Omit<React.ComponentPropsWithoutRef<"button">, "type"> {
    icon: LucideIcon
    label: string
    description?: string
    /** Trailing control (Switch, current-value label, etc.). When present the chevron is not shown. */
    trailing?: React.ReactNode
    /** Show a trailing chevron — for rows that navigate. Ignored if `trailing` is set. */
    chevron?: boolean
    destructive?: boolean
    /**
     * Render as a <label> so tapping anywhere on the row activates the trailing control
     * (native label behavior — the control must be a labelable element, e.g. a Switch).
     * Use instead of `onClick` for toggle rows: a button here would nest the control's
     * button inside another button.
     */
    asLabel?: boolean
}

/**
 * One row in the profile list. Renders as a button when interactive (own `onClick`, or an
 * `onClick` injected by an `asChild` trigger such as DropdownMenuTrigger), a label for
 * `asLabel` toggle rows, otherwise a div — so a chevron-only row stays a div and can sit
 * inside a NavLink without nesting a button in an anchor. Forwards its ref + extra props
 * so it can serve as a Radix `asChild` trigger.
 */
export const ProfileRow = forwardRef<HTMLButtonElement, ProfileRowProps>(function ProfileRow(
    { icon: Icon, label, description, onClick, trailing, chevron, destructive, asLabel, className, ...rest },
    ref,
) {
    // A Radix `asChild` trigger (e.g. DropdownMenuTrigger) opens on pointer-down and injects
    // aria-haspopup / data-state / key+pointer handlers rather than an `onClick` — so detect
    // it that way, not via onClick, to render a real button and wire press feedback.
    const isTrigger = "aria-haspopup" in rest
    const interactive = !!onClick || isTrigger
    // Press feedback only on rows that actually do something on tap — an action/trigger,
    // a navigation row (chevron), or a label row that toggles its trailing control.
    const pressable = interactive || chevron || asLabel
    // Ref may attach to a div/label in the non-button cases; the union is intentional.
    const Comp = (asLabel ? "label" : interactive ? "button" : "div") as "button"
    return (
        <Comp
            ref={ref}
            type={interactive ? "button" : undefined}
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 bg-surface-gray-1 p-3.5 md:py-2 text-left select-none transition-colors outline-none focus-visible:outline-none",
                // `data-[state=open]` covers asChild-trigger rows, where the menu opens on
                // pointer-down and would otherwise mask the :active highlight.
                pressable && "active:bg-surface-gray-3 data-[state=open]:bg-surface-gray-3",
                destructive ? "text-ink-red-8 bg-surface-red-1 active:bg-surface-red-2 data-[state=open]:bg-surface-red-2" : "text-ink-gray-8",
                className,
            )}
            {...rest}
        >
            <Icon className={cn("size-5 shrink-0", destructive ? "text-ink-red-8" : "text-ink-gray-6")} />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base md:text-sm font-medium">{label}</span>
                {description && <span className="truncate text-sm md:text-xs text-ink-gray-6">{description}</span>}
            </div>
            {trailing ?? (chevron && <ChevronRight className="size-4 shrink-0 text-ink-gray-4" />)}
        </Comp>
    )
})
