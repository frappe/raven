import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import { cn } from "@lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-surface-elevation-1 flex h-full w-full flex-col overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command className="[&_[cmdk-group-heading]]:text-ink-gray-4 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const COMMAND_INPUT_VARIANTS = {
  /** An input that reads as a control in its own right — the command palette, where
   *  typing IS the feature and the field carries the whole surface. */
  field:
    "m-1.5 h-8 gap-2 rounded px-2.5 py-2 border border-transparent bg-surface-gray-2 not-focus-within:hover:bg-surface-gray-3 focus-within:bg-surface-base focus-within:border-outline-gray-4 focus-within:shadow-sm focus-within:focus-ring",
  /** Full-bleed header, no box — Frappe UI's multiselect. In a filter popover the list is
   *  the content and the field only narrows it, so a hairline is all the division it needs;
   *  a boxed field there reads as a second surface. Keeps the search icon, which is what
   *  marks the row as a field at all once the box is gone. */
  plain: "h-9 md:h-8 gap-2 px-3 border-b border-outline-gray-2",
  /** Full-bleed header WITH the search icon — the command palette. The dialog frame
   *  is the box, so the field draws no box of its own: icon + hairline below, per
   *  frappe-ui's docs palette (py-3 + text-base ≈ h-10; mobile keeps a taller touch
   *  target). The [&_svg] tint is the palette's darker icon (ink-gray-6, a step up
   *  from the shared gray-4) — styled from here so the icon element stays identical
   *  across variants. */
  palette: "h-12 md:h-10 gap-3 px-4.5 border-b border-outline-gray-2 [&_svg]:text-ink-gray-6",
}

function CommandInput({
  className,
  variant = "field",
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  variant?: keyof typeof COMMAND_INPUT_VARIANTS
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      // shrink-0 in the base: the wrapper is a flex child of a height-capped column
      // wherever it's used, and a long list would otherwise squeeze the field off its
      // own height.
      className={cn(
        "flex shrink-0 items-center transition-colors text-ink-gray-8",
        COMMAND_INPUT_VARIANTS[variant],
      )}
    >
      <SearchIcon className="size-4 shrink-0 text-ink-gray-4" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex w-full bg-transparent outline-hidden text-xl md:text-base placeholder:text-ink-gray-4",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-lg md:text-base"
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        // Heading = frappe-ui's palette group label (body-size regular, ink-gray-5) at
        // every breakpoint. The DEFAULT is the palette style, not DropdownMenuLabel's:
        // giving both styles unprefixed font-size utilities here and in an override
        // made the winner depend on Tailwind's generated order (the palette's mobile
        // heading silently lost and rendered 13px). Popovers that want the menu-label
        // type pin it themselves — see FilterCombobox. NOTE: spell heading type as real
        // utilities (text-base, font-medium…), never espresso's .text-sm-medium — that's
        // a plain @layer components class, and behind a [&_…] variant it compiles to
        // nothing, leaving the 16px UA default.
        "text-ink-gray-6 [&_[cmdk-group-heading]]:text-ink-gray-5 overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-base",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-outline-elevation-2 mx-0.5 h-px my-1", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "py-2 md:py-1.5 px-2 flex cursor-pointer text-ink-gray-7 items-center gap-2 rounded text-lg md:text-base relative outline-hidden select-none",
        "data-[selected=true]:bg-surface-gray-2 [&_svg:not([class*='text-'])]:text-ink-gray-6 data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-ink-gray-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 md:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-ink-gray-5 ms-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
