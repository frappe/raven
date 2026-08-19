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
        // relative anchors the sliding indicator span.
        underline: "relative group-data-[orientation=horizontal]/tabs:border-b border-outline-gray-1 group-data-[orientation=vertical]/tabs:border-e group-data-[orientation=horizontal]/tabs:gap-5 group-data-[orientation=vertical]/tabs:gap-5",
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
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<React.ComponentRef<typeof TabsPrimitive.List>>(null)

  // Slide the underline bar to the active trigger. Same approach as
  // frappe.ui.Tabs: JS only measures, CSS owns the animation.
  React.useLayoutEffect(() => {
    if (variant !== "underline") return
    const list = listRef.current
    if (!list) return
    const position = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]')
      if (!active) return
      const vertical = list.getAttribute("aria-orientation") === "vertical"
      list.style.setProperty("--tabs-indicator-x", `${vertical ? active.offsetTop : active.offsetLeft}px`)
      list.style.setProperty("--tabs-indicator-w", `${vertical ? active.offsetHeight : active.offsetWidth}px`)
    }
    position()
    // Radix flips data-state on the triggers when the tab changes. childList
    // too: a trigger mounting with data-state already set emits no attribute
    // mutation, so a dynamically added tab would otherwise go unnoticed.
    const states = new MutationObserver(position)
    states.observe(list, { subtree: true, childList: true, attributeFilter: ["data-state"] })
    const sizes = new ResizeObserver(position)
    sizes.observe(list)
    return () => {
      states.disconnect()
      sizes.disconnect()
    }
  }, [variant])

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
      ref={listRef}
    >
      {variant === "underline" && (
        // The active underline: a 1px bar shifted onto the list's border,
        // so it sits ON the gray line rather than a pixel above it.
        <span
          aria-hidden
          className={cn(
            // transition `translate`, not `transform`: Tailwind v4's translate-x
            // utilities set the separate `translate` property, so a `transform`
            // transition would leave the bar snapping while only width animates.
            "pointer-events-none absolute bg-ink-gray-9 transition-[width,height,translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            "group-data-[orientation=horizontal]/tabs:bottom-0 group-data-[orientation=horizontal]/tabs:left-0 group-data-[orientation=horizontal]/tabs:h-px group-data-[orientation=horizontal]/tabs:w-(--tabs-indicator-w) group-data-[orientation=horizontal]/tabs:translate-x-(--tabs-indicator-x) group-data-[orientation=horizontal]/tabs:translate-y-px",
            "group-data-[orientation=vertical]/tabs:top-0 group-data-[orientation=vertical]/tabs:end-0 group-data-[orientation=vertical]/tabs:w-px group-data-[orientation=vertical]/tabs:h-(--tabs-indicator-w) group-data-[orientation=vertical]/tabs:translate-y-(--tabs-indicator-x) group-data-[orientation=vertical]/tabs:translate-x-px",
          )}
        />
      )}
      {children}
    </TabsPrimitive.List>
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
        "whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
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
        // Variant: underline - the active bar is the sliding indicator in
        // TabsList, not a per-trigger border.


        // Variant: underline - Vertical (frappe-ui: symmetric px, NO vertical
        // padding — row rhythm comes from the list's gap; was ps-0 + pe/py)
        "group-data-[orientation=vertical]/tabs:group-data-[variant=underline]/tabs-list:group-data-[size=md]/tabs-list:px-2.5",
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
