import { forwardRef } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@lib/utils"

/**
 * Settings-list building blocks, shared by the mobile Preferences drawer and the
 * channel Settings tab: sections are divided stacks of flat rows (no card
 * backgrounds), each row = label (+ optional description) with a control or a
 * chevron at the end.
 */

/** A group of rows with an optional caption + explainer line above it. */
export const PrefSection = ({
    title,
    description,
    children,
}: {
    title?: string
    description?: string
    children: React.ReactNode
}) => (
    <div className="flex flex-col gap-1">
        {(title || description) && (
            <div className="flex flex-col gap-0.5">
                {title && <span className="text-sm font-medium text-ink-gray-5">{title}</span>}
                {description && <span className="text-sm text-ink-gray-4">{description}</span>}
            </div>
        )}
        <div className="flex flex-col divide-y divide-outline-gray-1">{children}</div>
    </div>
)

/**
 * One setting row: label (+ optional description) with the control at the end.
 * `asLabel` renders the row as a <label> so tapping anywhere flips its Switch
 * (native label activation — same trick as ProfileRow's toggle rows).
 * `disabled` dims the row and blocks taps — for rows a master toggle subsumes;
 * remember to also disable the control itself.
 */
export const PrefRow = ({
    label,
    description,
    control,
    asLabel,
    disabled,
}: {
    label: string
    description?: string
    control: React.ReactNode
    asLabel?: boolean
    disabled?: boolean
}) => {
    const Comp = (asLabel ? "label" : "div") as "div"
    return (
        <Comp
            className={cn(
                "flex items-center justify-between gap-6 py-3 transition-opacity",
                asLabel && "select-none",
                disabled && "opacity-50 pointer-events-none",
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-base text-ink-gray-8">{label}</span>
                {description && <span className="text-sm leading-snug text-ink-gray-5">{description}</span>}
            </div>
            <div className="shrink-0">{control}</div>
        </Comp>
    )
}

/**
 * An ACTION row in the same layout — a button that opens a dialog/sheet
 * (archive, leave, delete). Forwards ref + props so it works as a Radix
 * `asChild` trigger. Destructive = red text; the confirm dialog carries the
 * weight, so no red background here.
 */
export const PrefActionRow = forwardRef<
    HTMLButtonElement,
    Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
        label: string
        description?: string
        destructive?: boolean
    }
>(function PrefActionRow({ label, description, destructive, className, ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className={cn(
                "flex w-full items-center justify-between gap-6 py-3 text-left select-none outline-none transition-colors",
                "active:bg-surface-gray-2 data-[state=open]:bg-surface-gray-2",
                className,
            )}
            {...rest}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <span className={cn("text-base", destructive ? "text-ink-red-8" : "text-ink-gray-8")}>{label}</span>
                {description && <span className="text-sm leading-snug text-ink-gray-5">{description}</span>}
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-gray-4" />
        </button>
    )
})
