import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { useIsMobile } from "@hooks/use-mobile"
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled"
import { ReadReceiptsList } from "../ReadReceiptsList"
import type { Message } from "@raven/types/common/Message"
import _ from "@lib/translate"

/**
 * "View read receipts" on mobile — who has read the message, as its own bottom
 * sheet (the same shape as ReactionsDialog: the action sheet closes, this one
 * opens). Desktop reaches the same list as a nested submenu off the message
 * menus, so the Dialog branch here is just a fallback shell — it only shows if
 * something ever opens this dialog on desktop.
 */
export const ReadReceiptsDialog = ({
    message,
    open,
    onClose,
}: {
    message: Message | null
    open: boolean
    onClose: () => void
}) => {
    const isMobile = useIsMobile()
    const noDragProps = useNoDragWhileScrolled()

    if (!message) return null

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
                <DrawerContent>
                    <DrawerTitle className="px-4 pb-4 pt-1 text-left text-2xl-semibold text-ink-gray-9">
                        {_("Read by")}
                    </DrawerTitle>
<DrawerDescription className="sr-only">{_("Who has read this message")}</DrawerDescription>
                    {/* Positional no-drag (see useNoDragWhileScrolled): the readers list
                        scrolls past its cap; while scrolled the swipe belongs to it, and
                        a pull from the top dismisses the sheet. */}
                    <div {...noDragProps} className="px-1 pb-4">
                        <ReadReceiptsList message={message} sheet />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{_("Read by")}</DialogTitle>
                    <DialogDescription className="sr-only">{_("View who has read this message.")}</DialogDescription>
                </DialogHeader>
                <ReadReceiptsList message={message} />
            </DialogContent>
        </Dialog>
    )
}
