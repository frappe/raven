import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center select-none rounded-full whitespace-nowrap gap-1 w-fit shrink-0 [&>svg]:pointer-events-none overflow-clip",
  {
    variants: {
      variant: {
        solid: "",
        subtle: "",
        outline: "bg-transparent border",
        ghost: "bg-transparent",
      },
      size: {
        sm: "h-4 text-xs px-1.5 [&>svg]:size-2.5",
        md: "h-5 text-xs px-1.5 [&>svg]:size-2.5",
        lg: "h-6 text-sm px-2 [&>svg]:size-3",
      },
      theme: {
        gray: "",
        blue: "",
        green: "",
        amber: "",
        red: "",
        violet: "",
      },
    },
    compoundVariants: [
      // Solid badges — gray is the exception (its saturated step is -10).
      { variant: "solid", theme: "gray", className: "text-ink-base bg-surface-gray-10" },
      { variant: "solid", theme: "blue", className: "text-ink-blue-1 bg-surface-blue-7" },
      { variant: "solid", theme: "green", className: "text-ink-green-1 bg-surface-green-7" },
      { variant: "solid", theme: "amber", className: "text-ink-amber-1 bg-surface-amber-7" },
      { variant: "solid", theme: "red", className: "text-ink-red-1 bg-surface-red-7" },
      { variant: "solid", theme: "violet", className: "text-ink-violet-1 bg-surface-violet-7" },
      // Subtle badges
      { variant: "subtle", theme: "gray", className: "text-ink-gray-6 bg-surface-gray-2" },
      { variant: "subtle", theme: "blue", className: "text-ink-blue-8 bg-surface-blue-2" },
      { variant: "subtle", theme: "green", className: "text-ink-green-8 bg-surface-green-2" },
      { variant: "subtle", theme: "amber", className: "text-ink-amber-8 bg-surface-amber-2" },
      { variant: "subtle", theme: "red", className: "text-ink-red-8 bg-surface-red-2" },
      { variant: "subtle", theme: "violet", className: "text-ink-violet-8 bg-surface-violet-2" },
      // Outline badges (the `border` comes from the outline variant)
      { variant: "outline", theme: "gray", className: "text-ink-gray-6 border-outline-gray-2" },
      { variant: "outline", theme: "blue", className: "text-ink-blue-8 border-outline-blue-3" },
      { variant: "outline", theme: "green", className: "text-ink-green-8 border-outline-green-3" },
      { variant: "outline", theme: "amber", className: "text-ink-amber-8 border-outline-amber-3" },
      { variant: "outline", theme: "red", className: "text-ink-red-8 border-outline-red-3" },
      { variant: "outline", theme: "violet", className: "text-ink-violet-8 border-outline-violet-3" },
      // Ghost badges
      { variant: "ghost", theme: "gray", className: "text-ink-gray-6" },
      { variant: "ghost", theme: "blue", className: "text-ink-blue-8" },
      { variant: "ghost", theme: "green", className: "text-ink-green-8" },
      { variant: "ghost", theme: "amber", className: "text-ink-amber-8" },
      { variant: "ghost", theme: "red", className: "text-ink-red-8" },
      { variant: "ghost", theme: "violet", className: "text-ink-violet-8" },
    ],
    defaultVariants: {
      variant: "subtle",
      size: "md",
      theme: "gray",
    },
  }
)

function Badge({
  className,
  variant = "subtle",
  size = "md",
  theme = "gray",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  Omit<VariantProps<typeof badgeVariants>, "theme"> & {
    asChild?: boolean
    /** `orange` is a deprecated alias for `amber`. */
    theme?: NonNullable<VariantProps<typeof badgeVariants>["theme"]> | "orange"
  }) {
  const Comp = asChild ? Slot.Root : "span"
  const resolvedTheme = theme === "orange" ? "amber" : theme

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      data-theme={resolvedTheme}
      className={cn(badgeVariants({ variant, size, theme: resolvedTheme }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
