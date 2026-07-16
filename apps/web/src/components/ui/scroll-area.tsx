import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@lib/utils"

function ScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** Classes for the VIEWPORT — the element that actually scrolls. Size
   *  constraints like `max-h-64` must go here, not on the root: the viewport's
   *  `size-full` resolves against the root's definite height, and a root with
   *  only a max-height has none (content just grew past it, unclipped).
   *  Mirrors frappe-ui ScrollArea's `viewportClass`. */
  viewportClassName?: string
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn("size-full rounded-[inherit] transition-[color,box-shadow]", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

/** Geometry + colors mirror frappe-ui's ScrollBar (10px bar, 2px padding →
 *  6px rounded thumb; gray-400 light / gray-700 dark — which is
 *  surface-gray-5 / surface-gray-2 in Espresso's semantic tokens). The global
 *  native-scrollbar CSS in index.css uses the same thumb colors, so both
 *  kinds of scrollbar look identical. */
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-0.5 transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5",
        orientation === "horizontal" && "h-2.5 flex-col",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-lg bg-surface-gray-5 dark:bg-surface-gray-2"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
