import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@components/ui/dialog"
import {
    Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@components/ui/drawer"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { ScheduleTimePicker } from "./ScheduleTimePicker"
import type { SchedulePick } from "./scheduleTime"

type ScheduleSendDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (pick: SchedulePick) => void
    /** Confirm in-flight — disables the buttons. */
    busy?: boolean
}

/**
 * Overlay wrapper around ScheduleTimePicker: Dialog on desktop / Drawer on mobile.
 * Pure picker — the caller owns the POST.
 */
export const ScheduleSendDialog = ({ open, onOpenChange, onConfirm, busy }: ScheduleSendDialogProps) => {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DrawerHeader>
                        <DrawerTitle>{_("Schedule message")}</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-2">
                        <ScheduleTimePicker onConfirm={onConfirm} onCancel={() => onOpenChange(false)} busy={busy} />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-fit max-w-fit" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{_("Schedule message")}</DialogTitle>
                </DialogHeader>
                <ScheduleTimePicker onConfirm={onConfirm} onCancel={() => onOpenChange(false)} busy={busy} />
            </DialogContent>
        </Dialog>
    )
}
