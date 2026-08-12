import * as React from "react"
import { cva } from "class-variance-authority"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@lib/utils"

/* ----- TabsButton — frappe-ui's TabButtons, ported -----
 *
 * A tab-LOOKING control that is semantically a RADIO group: for view toggles
 * and mode switches (e.g. the Files tab's list/grid switch), where real Tabs
 * are wrong — ARIA forbids tabs inside tabs, and the choice is a presentation
 * mode, not navigation. Radix RadioGroup supplies roving focus + arrow keys.
 *
 * Variants/sizes mirror frappe-ui's TabButtons/Pill (subtle | ghost |
 * underline, sm | md). Not ported (no consumer yet): vertical orientation and
 * the browser-tab variant — see frappe-ui src/components/TabButtons.
 */

type TabsButtonVariant = "subtle" | "ghost" | "underline"
type TabsButtonSize = "sm" | "md"

/** Root → items styling channel (variant/size), so items don't each repeat props. */
const TabsButtonContext = React.createContext<{ variant: TabsButtonVariant; size: TabsButtonSize }>({
  variant: "subtle",
  size: "sm",
})

const tabsButtonVariants = cva("inline-flex w-fit shrink-0 items-center overflow-hidden", {
  variants: {
    variant: {
      subtle: "bg-surface-gray-2 p-px",
      ghost: "bg-surface-base p-px",
      underline: "gap-6 border-b border-outline-gray-1",
    },
    size: {
      sm: "",
      md: "",
    },
  },
  compoundVariants: [
    { variant: ["subtle", "ghost"], size: "sm", className: "gap-1 rounded" },
    { variant: ["subtle", "ghost"], size: "md", className: "gap-1.5 rounded-[10px]" },
  ],
  defaultVariants: { variant: "subtle", size: "sm" },
})

const tabsButtonItemVariants = cva(
  [
    // Pill base (frappe-ui Pill.vue)
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap text-sm leading-[16.1px]",
    "transition-[background-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
    "disabled:pointer-events-none disabled:opacity-60",
    "text-ink-gray-5 data-[state=checked]:text-ink-gray-8",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Raised active pill
        subtle:
          "data-[state=unchecked]:hover:bg-surface-gray-3/80 data-[state=unchecked]:hover:text-ink-gray-7 data-[state=checked]:bg-surface-elevation-3 data-[state=checked]:shadow-sm",
        // Flat active pill (for use on plain backgrounds)
        ghost:
          "data-[state=unchecked]:hover:bg-surface-gray-3/80 data-[state=unchecked]:hover:text-ink-gray-7 data-[state=checked]:bg-surface-gray-2",
        // Indicator overlays the root's rail so it reads as a thicker, darker
        // section of the same line — not a bar floating beside the label
        underline:
          "border-b border-transparent data-[state=unchecked]:hover:text-ink-gray-7 data-[state=checked]:font-medium data-[state=checked]:after:absolute data-[state=checked]:after:inset-x-0 data-[state=checked]:after:-bottom-px data-[state=checked]:after:h-px data-[state=checked]:after:bg-ink-gray-8",
      },
      size: {
        sm: "[&_svg:not([class*='size-'])]:size-4",
        md: "[&_svg:not([class*='size-'])]:size-[18px]",
      },
      /** Icon-only squares (pass aria-label!) vs labeled pills. */
      iconOnly: { true: "", false: "" },
    },
    compoundVariants: [
      { variant: ["subtle", "ghost"], size: "sm", iconOnly: false, className: "h-6.5 rounded-[7px] px-2 py-[5px]" },
      { variant: ["subtle", "ghost"], size: "md", iconOnly: false, className: "h-7 rounded-[9px] px-2.5 py-1.5" },
      { variant: ["subtle", "ghost"], size: "sm", iconOnly: true, className: "size-6.5 rounded-[7px] p-[5px]" },
      { variant: ["subtle", "ghost"], size: "md", iconOnly: true, className: "size-7 rounded-[9px] p-[5px]" },
      { variant: "underline", size: "sm", className: "h-7" },
      { variant: "underline", size: "md", className: "h-7.5" },
    ],
    defaultVariants: { variant: "subtle", size: "sm", iconOnly: false },
  }
)

function TabsButton({
  className,
  variant = "subtle",
  size = "sm",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  variant?: TabsButtonVariant
  size?: TabsButtonSize
}) {
  const context = React.useMemo(() => ({ variant, size }), [variant, size])
  return (
    <TabsButtonContext.Provider value={context}>
      <RadioGroupPrimitive.Root
        data-slot="tabs-button"
        data-variant={variant}
        data-size={size}
        orientation="horizontal"
        className={cn(tabsButtonVariants({ variant, size }), className)}
        {...props}
      />
    </TabsButtonContext.Provider>
  )
}

function TabsButtonItem({
  className,
  iconOnly = false,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { iconOnly?: boolean }) {
  const { variant, size } = React.useContext(TabsButtonContext)
  return (
    <RadioGroupPrimitive.Item
      data-slot="tabs-button-item"
      className={cn(tabsButtonItemVariants({ variant, size, iconOnly }), className)}
      {...props}
    />
  )
}

export { TabsButton, TabsButtonItem, tabsButtonVariants }
