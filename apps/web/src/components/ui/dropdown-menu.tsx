import * as React from "react"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@lib/utils"
import { Switch } from "@components/ui/switch"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-surface-elevation-2 min-w-40 rounded-lg p-1 shadow-2xl ring-1 ring-black/5 focus-visible:outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

const BASE_ITEM_STYLES = `focus-visible:outline-none select-none relative flex cursor-pointer items-center
gap-2 rounded px-2 py-2 md:py-1.5 text-lg md:text-base text-ink-gray-7 data-[variant=destructive]:text-ink-red-8
data-[variant=destructive]:*:[svg]:text-ink-red-8! data-[variant=destructive]:focus:bg-surface-red-3 [&_svg:not([class*='text-'])]:text-ink-gray-6 [&_svg:not([class*='size-'])]:size-4.5 md:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0
data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:text-ink-gray-4 data-disabled:data-[variant=destructive]:text-ink-gray-4 data-disabled:data-[variant=destructive]:*:[svg]:text-ink-gray-4! data-disabled:*:[svg]:text-ink-gray-4! focus:bg-surface-gray-2 data-[state=checked]:bg-surface-gray-3 data-inset:ps-8`

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        BASE_ITEM_STYLES,
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        BASE_ITEM_STYLES,
        className
      )}
      checked={checked}
      {...props}
    >
      {children}
      <span className="pointer-events-none flex size-4 ms-2 px-2 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

/**
 * A menu item with a trailing SWITCH — for settings that live inside a
 * dropdown (frappe-ui's Dropdown `switch: true` items, ported). Toggling
 * never closes the menu, so several can be flipped in one visit. Built on
 * CheckboxItem for the menuitemcheckbox semantics; the Switch is visual only
 * (a live one would be a second, nested control fighting the item for events).
 */
function DropdownMenuSwitchItem({
  className,
  children,
  checked,
  switchSize = "sm",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  /** Trailing switch size — pass "md" on touch surfaces. */
  switchSize?: React.ComponentProps<typeof Switch>["size"]
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-switch-item"
      className={cn(
        BASE_ITEM_STYLES,
        // No checked-row background — the Switch already shows the state, and
        // several "on" rows all painted gray would read as selection, not state
        "data-[state=checked]:bg-transparent data-[state=checked]:focus:bg-surface-gray-2 justify-between",
        className
      )}
      checked={checked}
      {...props}
      // After the spread ON PURPOSE: toggling must never close the menu
      onSelect={(event) => event.preventDefault()}
    >
      {children}
      <Switch
        size={switchSize}
        checked={checked === true}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none ms-auto"
      />
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        BASE_ITEM_STYLES,
        className
      )}
      {...props}
    >
      {children}
      <span className="pointer-events-none flex size-4 ps-2 items-center justify-center ms-auto">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm-medium text-ink-gray-4 data-inset:ps-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-outline-elevation-2 my-1 h-px mx-0.5", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-ink-gray-5 ms-auto text-xs tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        BASE_ITEM_STYLES,
        "data-[state=open]:bg-surface-gray-2",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto cn-rtl-flip size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-surface-elevation-2 rounded-lg p-1 shadow-2xl ring-1 ring-black/5 min-w-40 text-ink-gray-6 focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuSwitchItem,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
