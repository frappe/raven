import { cn } from "@lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-surface-gray-2 text-ink-gray-7 pointer-events-none inline-flex h-6 w-fit min-w-6 items-center justify-center gap-1 rounded px-1.5 font-sans text-xs-medium select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-surface-gray-6 [[data-slot=tooltip-content]_&]:text-ink-gray-1",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
