import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list text-ink-gray-5 inline-flex group-data-[orientation=horizontal]/tabs:w-full group-data-[orientation=vertical]/tabs:w-fit items-center justify-start group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        subtle: "bg-surface-gray-2 p-px",
        outline: "p-px border border-outline-gray-1",
        // gap-5 both orientations = frappe-ui Tabs (list gap-5); was gap-6/gap-2
        underline: "group-data-[orientation=horizontal]/tabs:border-b border-outline-gray-1 group-data-[orientation=vertical]/tabs:border-e group-data-[orientation=horizontal]/tabs:gap-5 group-data-[orientation=vertical]/tabs:gap-5",
      },
      // no fixed list heights (frappe-ui uses min-h-fit; height comes from
      // the triggers' padding) — size now only drives trigger metrics
      size: {
        sm: "",
        md: ""
      }
    },
    compoundVariants: [
      {
        variant: "subtle",
        size: "sm",
        className: "rounded gap-1"
      },
      {
        variant: "subtle",
        size: "md",
        className: "rounded-md gap-1.5 font-medium"
      },
      {
        variant: "outline",
        size: "sm",
        className: "rounded gap-1",
      },
      {
        variant: "outline",
        size: "md",
        className: "rounded-md gap-1.5 font-medium",
      },
      {
        variant: "underline",
        size: "sm",
        className: "",
      },
      {
        variant: "underline",
        size: "md",
        className: "",
      },
    ],
    defaultVariants: {
      variant: "underline",
      size: "md",
    },
  }
)

function TabsList({
  className,
  variant = "underline",
  size = "md",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Common
        "whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 w-full",
        "text-ink-gray-5 text-base data-[state=active]:text-ink-gray-9 hover:text-ink-gray-9 relative gap-2",
        "flex items-center justify-center group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
        // Icon Sizes - 16px for sm, 18px for md
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 group-data-[size=sm]/tabs-list:[&_svg:not([class*='size-'])]:size-4 group-data-[size=md]/tabs-list:[&_svg:not([class*='size-'])]:size-4.5",

        // Variant: subtle, size: sm
        "group-data-[variant=subtle]/tabs-list:group-data-[size=sm]/tabs-list:py-[5px] group-data-[variant=subtle]/tabs-list:group-data-[size=sm]/tabs-list:px-2 group-data-[variant=subtle]/tabs-list:group-data-[size=sm]/tabs-list:rounded-[7px]",
        // Variant: subtle, size: md
        "group-data-[variant=subtle]/tabs-list:group-data-[size=md]/tabs-list:py-1.5 group-data-[variant=subtle]/tabs-list:group-data-[size=md]/tabs-list:px-2.5 group-data-[variant=subtle]/tabs-list:group-data-[size=md]/tabs-list:rounded-[9px]",
        // Variant: subtle - active - background, text color and shadow applied
        "group-data-[variant=subtle]/tabs-list:data-[state=active]:bg-surface-elevation-3 group-data-[variant=subtle]/tabs-list:data-[state=active]:shadow",


        // Variant: outline, size: sm
        "group-data-[variant=outline]/tabs-list:group-data-[size=sm]/tabs-list:py-[5px] group-data-[variant=outline]/tabs-list:group-data-[size=sm]/tabs-list:px-2 group-data-[variant=outline]/tabs-list:group-data-[size=sm]/tabs-list:rounded-[7px]",
        // Variant: outline, size: md
        "group-data-[variant=outline]/tabs-list:group-data-[size=md]/tabs-list:py-1.5 group-data-[variant=outline]/tabs-list:group-data-[size=md]/tabs-list:px-2.5 group-data-[variant=outline]/tabs-list:group-data-[size=md]/tabs-list:rounded-[9px]",
        // Variant: outline - active - background, text color and shadow applied
        "group-data-[variant=outline]/tabs-list:data-[state=active]:bg-surface-elevation-3 group-data-[variant=outline]/tabs-list:data-[state=active]:shadow",

        // Variant: underline - horizontal
        "group-data-[variant=underline]/tabs-list:rounded-none ",
        // Variant: underline - horizontal - no radius
        "group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:px-0",
        // Variant: underline, size: sm
        "group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:group-data-[size=sm]/tabs-list:py-1.5 group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:group-data-[size=sm]/tabs-list:px-1.5",
        // Variant: underline, size: md (py-2.5 = frappe-ui Tabs trigger; was py-[7px])
        "group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:group-data-[size=md]/tabs-list:py-2.5 group-data-[variant=underline]/tabs-list:group-data-[size=md]/tabs-list:font-medium",
        // Variant: underline - horizontal - active - border applied
        "group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:border-b group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:border-b-transparent group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:data-[state=active]:border-b-ink-gray-9 group-data-[orientation=horizontal]/tabs:group-data-[variant=underline]/tabs-list:bottom-px",


        // Variant: underline - Vertical (frappe-ui: symmetric px, NO vertical
        // padding — row rhythm comes from the list's gap; was ps-0 + pe/py)
        "group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:group-data-[size=md]/tabs-list:px-2.5",
        // Variant: underline - vertical - active - border applied
        "group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:border-e group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:border-e-transparent group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:data-[state=active]:border-e-ink-gray-9 group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:-right-px",

        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none group-data-[orientation=vertical]/tabs:px-2 group-data-[orientation=horizontal]/tabs:py-2 group-data-[orientation=vertical]/tabs:h-full", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
