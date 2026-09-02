import { useState } from "react"
import type { Dayjs } from "dayjs"
import { CalendarClockIcon } from "lucide-react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@components/ui/dialog"
import {
    Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@components/ui/drawer"
import { MessageBody } from "@components/features/message/renderers/MessageContent"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { ScheduleTimePicker } from "./ScheduleTimePicker"
import { formatDateTimeLabel, type SchedulePick } from "@lib/timeUtils"

type ScheduleSendDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (pick: SchedulePick) => void
    /** The composer's current HTML — shown as a live preview pane (desktop only). */
    text?: string
    /** Confirm in-flight — disables the buttons. */
    busy?: boolean
}

/**
 * Overlay around ScheduleTimePicker: Dialog on desktop (with a live message
 * preview on top) / Drawer on mobile. The caller owns the POST.
 */
export const ScheduleSendDialog = ({ open, onOpenChange, onConfirm, text, busy }: ScheduleSendDialogProps) => {
    const isMobile = useIsMobile()
    const [picked, setPicked] = useState<Dayjs | null>(null)

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DrawerHeader>
                        <DrawerTitle>{_("Schedule message")}</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-4 pb-2">
                        {text && <SchedulePreview text={text} picked={picked} />}
                        <ScheduleTimePicker
                            onConfirm={onConfirm}
                            onCancel={() => onOpenChange(false)}
                            onPickChange={setPicked}
                            busy={busy}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{_("Schedule message")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {text && <SchedulePreview text={text} picked={picked} />}
                    <ScheduleTimePicker
                        onConfirm={onConfirm}
                        onCancel={() => onOpenChange(false)}
                        onPickChange={setPicked}
                        busy={busy}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

/**
 * The message as it will land, under the live-picked delivery time — the
 * chat-stream message shape (mirrors ScheduledMessageCard).
 */
const SchedulePreview = ({ text, picked }: { text: string; picked: Dayjs | null }) => {
    const { name: currentUser } = useUserCookieData()
    const user = useUsersById().get(currentUser)

    return (
        <div className="flex w-full gap-3 py-1">
            {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5 text-content">
                    {user && <span className="truncate font-medium text-ink-gray-8">{user.full_name}</span>}
                    <span className="flex shrink-0 items-baseline gap-1 text-xs text-ink-gray-4">
                        <CalendarClockIcon className="h-3 w-3 shrink-0 self-center" />
                        {picked ? _("Scheduled for {0}", [formatDateTimeLabel(picked)]) : _("Pick a delivery time")}
                    </span>
                </div>
                {/* Long messages scroll inside the pane — the picker row sets the dialog's height. */}
                <div className="mt-1 max-h-72 overflow-y-auto [&_p]:my-0">
                    <MessageBody content={text} />
                </div>
            </div>
        </div>
    )
}
