import { useState } from "react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { BellOffIcon, BellRingIcon, ChevronDownIcon, SendHorizontalIcon, SendIcon } from "lucide-react"
import { useIsMobile } from "@hooks/use-mobile"
import { useLongPress } from "@hooks/useLongPress"
import type { QuietSendMode } from "@hooks/useQuietHours"
import { KeyboardMetaKeyIcon } from "@components/ui/keyboard-keys"
import _ from "@lib/translate"
import { ScheduleSendMenu } from "@components/features/schedule-send/ScheduleSendMenu"
import { ScheduleSendSheet, SheetRow } from "@components/features/schedule-send/ScheduleSendSheet"
import type { SchedulePick } from "@lib/timeUtils"

type SendButtonProps = {
    onSend: () => void
    /** Send without notifying recipients (the server skips push notifications). */
    onSendSilently: () => void
    /** Send WITH notifications — the per-message override while quiet hours
     *  make silent the default (quietMode "auto"). */
    onSendLoud: () => void
    /** Quiet hours state. "auto": sends default to silent — the send icon
     *  becomes the bell-off and the menu offers the loud override. "nudge"
     *  changes nothing here (the composer banner carries the hint). */
    quietMode?: QuietSendMode
    /** A preset slot was picked from the schedule submenu — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time dialog. */
    onScheduleSend: () => void
    /** Scheduling needs text and no attachments (v1) — disable the submenu otherwise. */
    scheduleDisabled?: boolean
    disabled?: boolean
    /** Send is held while attachments finish uploading — show a spinner. */
    loading?: boolean
}

/**
 * Desktop: a split button — "Send" plus a chevron opening send options (silent
 * send and a schedule submenu with Today/Tomorrow preset slots plus a custom
 * date & time entry). Mobile: an icon-only round button; a long-press opens the
 * same options in a bottom sheet, a plain tap sends.
 */
const SendButton = ({
    onSend,
    onSendSilently,
    onSendLoud,
    quietMode,
    onSchedulePick,
    onScheduleSend,
    scheduleDisabled,
    disabled,
    loading,
}: SendButtonProps) => {
    const isMobile = useIsMobile()
    const [menuOpen, setMenuOpen] = useState(false)

    // Mobile: a long-press opens the send-options menu (shared hook — timer,
    // drag stand-down, haptic; the click that ends a fired press is consumed
    // in onClick below).
    const { handlers: longPressHandlers, consumeLongPress } = useLongPress(() => setMenuOpen(true))

    // Whatever the current default is, the menu offers the OPPOSITE. Normally
    // sends are loud and the menu offers silent; in quiet-hours "auto" mode
    // silent IS the default, so the menu offers the loud override — the urgent
    // late-night message stays one deliberate gesture away.
    const notifyItem = quietMode === "auto" ? (
        <DropdownMenuItem onSelect={onSendLoud}>
            <BellRingIcon />
            {_("Send with notification")}
        </DropdownMenuItem>
    ) : (
        <DropdownMenuItem
            onSelect={onSendSilently}
        >
            <BellOffIcon />
            {_("Send without notification")}
            {/* The keyboard chord for this action (desktop only — mobile has no
                keyboard, and this shared item renders in both menus). */}
            {!isMobile && (
                <DropdownMenuShortcut>
                    <KeyboardMetaKeyIcon />⇧↵
                </DropdownMenuShortcut>
            )}
        </DropdownMenuItem>
    )

    // Desktop menu: silent send + the schedule submenu.
    const menuItems = (
        <>
            {notifyItem}
            <ScheduleSendMenu onSchedulePick={onSchedulePick} onScheduleSend={onScheduleSend} scheduleDisabled={scheduleDisabled} />
        </>
    )

    // Mobile sheet: the same notify option as a sheet row.
    const closeSheet = () => setMenuOpen(false)
    const sheetNotifyRow = quietMode === "auto" ? (
        <SheetRow onClick={() => { closeSheet(); onSendLoud() }}>
            <BellRingIcon />
            {_("Send with notification")}
        </SheetRow>
    ) : (
        <SheetRow onClick={() => { closeSheet(); onSendSilently() }}>
            <BellOffIcon />
            {_("Send without notification")}
        </SheetRow>
    )

    // Quiet-hours "auto": a plain send WILL be silent, and that must be
    // visible before the tap — the send icon itself becomes the bell-off.
    // Nudge mode changes nothing here; the composer banner carries the hint.
    const autoSilent = quietMode === "auto"

    if (isMobile) {
        // The sheet's overlay covers the button while it is open, so a tap outside
        // closes the sheet without reaching the send button.
        return (
            <>
                <Button
                    size="lg"
                    type="button"
                    onClick={() => {
                        // The click that ends the long-press itself.
                        if (consumeLongPress()) return
                        onSend()
                    }}
                    {...longPressHandlers}
                    // Never steal focus from the editor: if the user is typing
                    // (keyboard open), tapping Send keeps it open naturally.
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={disabled}
                    variant="solid"
                    loading={loading}
                    isIconButton
                    // No OS selection or callout on the long-press. Android still drops the editor's focus
                    // (and its keyboard) when its own long-press fires, so the send options open without it there.
                    className="rounded-full select-none [-webkit-touch-callout:none]"
                    aria-label={autoSilent ? _("Send message silently") : _("Send message")}
                >
                    {!loading && (autoSilent ? <BellOffIcon /> : <SendHorizontalIcon />)}
                </Button>
                <ScheduleSendSheet
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    sendOptions={sheetNotifyRow}
                    onSchedulePick={onSchedulePick}
                    onScheduleSend={onScheduleSend}
                    scheduleDisabled={scheduleDisabled}
                />
            </>
        )
    }

    return (
        <div className="flex items-center gap-px">
            <Button
                size="sm"
                type="button"
                onClick={() => onSend()}
                onMouseDown={(e) => e.preventDefault()}
                disabled={disabled}
                variant="subtle"
                loading={loading}
                loadingText={_("Sending...")}
                className="rounded-e-none"
                aria-label={autoSilent ? _("Send message silently") : _("Send message")}
                title={autoSilent ? _("Quiet hours - sending silently") : undefined}
            >
                {/* While loading the Button shows its own spinner; don't also render content. */}
                {!loading && (
                    <>
                        {autoSilent ? <BellOffIcon /> : <SendIcon />}
                        <span>{_("Send")}</span>
                    </>
                )}
            </Button>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="sm"
                        type="button"
                        variant="subtle"
                        isIconButton
                        disabled={disabled || loading}
                        onMouseDown={(e) => e.preventDefault()}
                        className="rounded-s-none"
                        aria-label={_("Send options")}
                    >
                        <ChevronDownIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="end"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    {menuItems}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export default SendButton
