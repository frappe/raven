import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { useIsMobile } from "@hooks/use-mobile"
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled"
import { cn } from "@lib/utils"

/**
 * A centred Dialog on desktop, a bottom sheet on mobile: a centred modal reads
 * wrong on a phone and fights the keyboard. Children render once and fit either
 * shell; a `footer` stays in view below the scrolling body in both.
 */
export const ResponsiveDialog = ({
    open,
    onClose,
    children,
    footer,
    bodyClassName = "gap-4 px-4 pb-8 pt-2",
    dialogClassName,
}: {
    open: boolean
    onClose: () => void
    children: ReactNode
    /** Stays in view below the scrolling body in the sheet. */
    footer?: ReactNode
    /** The sheet's scrolling body spacing. */
    bodyClassName?: string
    dialogClassName?: string
}) => {
    const isMobile = useIsMobile()
    const noDragProps = useNoDragWhileScrolled()

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
                <DrawerContent className="max-h-[90dvh]" onOpenAutoFocus={(event) => event.preventDefault()}>
                    {/* Positional no-drag (see useNoDragWhileScrolled): whichever scroller
                        moves — this wrapper, or a nested list like the attach checklist —
                        stamps itself, so scrolled content scrolls and a pull from the top
                        dismisses. The height cap keeps a long field list scrolling inside
                        the sheet instead of pushing it past the top of the screen. */}
                    <div {...noDragProps} className={cn("flex min-h-0 flex-col overflow-y-auto overscroll-contain", bodyClassName)}>
                        {children}
                    </div>
                    {footer}
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className={cn(footer && "overflow-hidden", dialogClassName)}>
                {footer ? (
                    <div className="flex min-h-0 flex-col gap-[inherit] overflow-y-auto">{children}</div>
                ) : (
                    children
                )}
                {footer}
            </DialogContent>
        </Dialog>
    )
}

/**
 * The matching header: DrawerTitle/DrawerDescription in the sheet (left-aligned,
 * per the other mobile sheets), DialogHeader in the dialog. The description is
 * ALWAYS rendered — screen readers need one on both primitives — and
 * `hideDescription` only demotes it to sr-only for sighted users.
 */
export const ResponsiveDialogHeader = ({
    title,
    description,
    hideDescription = false,
}: {
    title: ReactNode
    description: ReactNode
    hideDescription?: boolean
}) => {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <div className="flex flex-col gap-1">
                <DrawerTitle className="text-left">{title}</DrawerTitle>
                <DrawerDescription className={hideDescription ? "sr-only" : undefined}>{description}</DrawerDescription>
            </div>
        )
    }

    return (
        <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={hideDescription ? "sr-only" : undefined}>{description}</DialogDescription>
        </DialogHeader>
    )
}
