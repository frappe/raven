import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@lib/utils"

function Switch({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "md"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer cursor-pointer group/switch inline-flex shrink-0 items-center rounded-full transition-colors outline-none disabled:cursor-not-allowed",
        "data-[state=unchecked]:bg-surface-gray-4 data-[state=unchecked]:hover:bg-surface-gray-5 data-[state=unchecked]:active:bg-surface-gray-6 data-[state=unchecked]:disabled:bg-surface-gray-3",
        "data-[state=checked]:bg-surface-gray-10 data-[state=checked]:hover:bg-surface-gray-9 data-[state=checked]:active:bg-surface-gray-8 data-[state=checked]:disabled:bg-surface-gray-3",
        "data-[size=sm]:h-4 data-[size=sm]:w-6.5 data-[size=md]:h-5 data-[size=md]:w-8",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "shadow-switch block pointer-events-none rounded-full ring-0 transition-transform bg-surface-base",
          "group-data-[size=sm]/switch:size-3 group-data-[size=md]/switch:size-3.5",
          // Unchecked: keep thumb near the start edge (mirrored by dir)
          "ltr:data-[state=unchecked]:group-data-[size=sm]/switch:translate-x-0.5",
          "ltr:data-[state=unchecked]:group-data-[size=md]/switch:translate-x-[3px]",
          "rtl:data-[state=unchecked]:group-data-[size=sm]/switch:-translate-x-0.5",
          "rtl:data-[state=unchecked]:group-data-[size=md]/switch:-translate-x-[3px]",
          // Checked: move to opposite edge (mirrored by dir)
          "ltr:data-[state=checked]:translate-x-[calc(100%-0px)]",
          "rtl:data-[state=checked]:-translate-x-[calc(100%-0px)]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
