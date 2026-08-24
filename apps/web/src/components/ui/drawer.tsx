import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { cn } from "@lib/utils"

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
    return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

/**
 * A drawer opened from INSIDE another drawer (e.g. Add members on top of the
 * members sheet). Must be rendered within the parent DrawerContent's tree:
 * vaul then treats them as a stack — opening this scales/pushes the parent
 * sheet back (the same treatment shouldScaleBackground gives the page) and
 * dragging this one down reveals it again. A plain <Drawer> here would just
 * paint over the parent with no stacking relationship.
 */
function DrawerNested({ ...props }: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
    return <DrawerPrimitive.NestedRoot data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
    return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
    return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
    return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay
            data-slot="drawer-overlay"
            // transform-gpu: iOS standalone paints this overlay under the status
            // bar (edge-to-edge), and WebKit is lazy about repainting that strip
            // when a shared-layer fixed element goes away — the scrim's ghost sat
            // in the notch area for seconds after close. Its own compositor layer
            // gets invalidated as a unit. fill-mode:forwards: vaul's fadeOut
            // animation otherwise snaps back to full opacity between animation
            // end and Radix's unmount commit — normally invisible, but any lag
            // there flashed the scrim back on.
            className={cn("fixed inset-0 z-50 bg-black-200 dark:bg-black-700", className)}
            {...props}
        />
    )
}

function DrawerContent({ className, children, showHandle = true, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content> & { showHandle?: boolean }) {
    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                data-slot="drawer-content"
                className={cn(
                    // pb-[env(...)]: the sheet reaches the physical bottom edge of the
                    // screen, so keep content clear of the iOS home indicator by
                    // default. Callers that want edge-to-edge content (e.g. the full
                    // emoji picker) pass p-0, which wins over this.
                    "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t border-outline-gray-2 bg-surface-elevation-1 outline-none pb-[env(safe-area-inset-bottom)]",
                    className
                )}
                {...props}
            >
                {showHandle && <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-surface-gray-4 shrink-0" />}
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    )
}

/**
 * iOS-style sheet header: leading action (usually Cancel) — centered title —
 * trailing primary action. The convention for FORM/PICKER sheets: their
 * keyboard covers the bottom of the sheet, so a footer's primary button is
 * unreachable exactly while the user is typing; the top bar stays visible.
 * Menu-style sheets need no action bar, and desktop dialogs keep their
 * bottom-right footer.
 *
 * Renders the accessible DrawerTitle itself — the sheet body only needs to add
 * a (sr-only) DrawerDescription.
 */
function DrawerActionBar({
    title,
    leading,
    trailing,
    className,
}: {
    title: React.ReactNode
    leading?: React.ReactNode
    trailing?: React.ReactNode
    className?: string
}) {
    return (
        <div
            data-slot="drawer-action-bar"
            // Equal 1fr side columns keep the title truly centered even when the
            // two actions have different widths
            className={cn("grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-1", className)}
        >
            <div className="flex justify-start">{leading}</div>
            <DrawerTitle className="truncate text-lg-medium">{title}</DrawerTitle>
            <div className="flex justify-end">{trailing}</div>
        </div>
    )
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            data-slot="drawer-header"
            className={cn("flex flex-col gap-1.5 px-6 pt-4 pb-4", className)}
            {...props}
        />
    )
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            data-slot="drawer-footer"
            className={cn("flex items-center justify-end gap-3 border-t px-4 py-4 shrink-0", className)}
            {...props}
        />
    )
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
    return (
        <DrawerPrimitive.Title
            data-slot="drawer-title"
            className={cn("text-xl-semibold text-ink-gray-9", className)}
            {...props}
        />
    )
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            data-slot="drawer-description"
            className={cn("text-p-sm text-ink-gray-6", className)}
            {...props}
        />
    )
}

export {
    Drawer,
    DrawerActionBar,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerNested,
    DrawerOverlay,
    DrawerPortal,
    DrawerTitle,
    DrawerTrigger,
}
