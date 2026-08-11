import { useEffect, useRef, useState } from "react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { ChevronDownIcon, SendHorizontalIcon, SendIcon } from "lucide-react"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { ScheduleSendMenu } from "@components/features/schedule-send/ScheduleSendMenu"
import type { SchedulePick } from "@components/features/schedule-send/scheduleTime"

type SendButtonProps = {
    onSend: () => void
    /** A preset slot was picked from the submenu — schedule immediately. */
    onSchedulePick: (pick: SchedulePick) => void
    /** Open the custom date & time dialog. */
    onScheduleSend: () => void
    /** Scheduling needs text and no attachments (v1) — disable the submenu otherwise. */
    scheduleDisabled?: boolean
    disabled?: boolean
    /** Send is held while attachments finish uploading — show a spinner. */
    loading?: boolean
}

/** How long a touch must be held before it reads as "show send options" (ms). */
const LONG_PRESS_MS = 500

/**
 * Desktop: a split button — "Send" plus a chevron opening send options (a schedule
 * submenu with Today/Tomorrow preset slots plus a custom date & time entry). Mobile:
 * an icon-only round button; a long-press opens the same options menu, a plain tap sends.
 */
const SendButton = ({ onSend, onSchedulePick, onScheduleSend, scheduleDisabled, disabled, loading }: SendButtonProps) => {
    const isMobile = useIsMobile()
    const [menuOpen, setMenuOpen] = useState(false)

    // Mobile long-press: a timer armed on pointerdown opens the menu; any settle
    // (up / leave / cancel) before the threshold disarms it. When the long-press
    // fired, the click that follows the pointerup must NOT also send — the flag
    // is consumed by the click handler.
    const longPressTimer = useRef<number | null>(null)
    const longPressFired = useRef(false)

    const disarmLongPress = () => {
        if (longPressTimer.current !== null) {
            window.clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const armLongPress = () => {
        longPressFired.current = false
        disarmLongPress()
        longPressTimer.current = window.setTimeout(() => {
            longPressTimer.current = null
            longPressFired.current = true
            setMenuOpen(true)
        }, LONG_PRESS_MS)
    }

    // Unmount with a press still held: kill the pending timer so it can't fire
    // against a dead instance.
    useEffect(() => disarmLongPress, [])

    if (isMobile) {
        return (
            <DropdownMenu
                open={menuOpen}
                // Only the long-press timer may OPEN the menu — a plain tap on the
                // trigger must send, not toggle. Radix reports open-intent on tap;
                // ignore it and honour only close.
                onOpenChange={(open) => {
                    if (!open) setMenuOpen(false)
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button
                        size="lg"
                        type="button"
                        onClick={() => {
                            if (longPressFired.current) {
                                longPressFired.current = false
                                return
                            }
                            onSend()
                        }}
                        onPointerDown={armLongPress}
                        onPointerUp={disarmLongPress}
                        onPointerLeave={disarmLongPress}
                        onPointerCancel={disarmLongPress}
                        // Suppress the OS context menu a long-press can raise.
                        onContextMenu={(e) => e.preventDefault()}
                        // Never steal focus from the editor: if the user is typing
                        // (keyboard open), tapping Send keeps it open naturally.
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={disabled}
                        variant="solid"
                        loading={loading}
                        isIconButton
                        className="rounded-full"
                        aria-label={_("Send message")}
                    >
                        {!loading && <SendHorizontalIcon />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="end"
                    // Keep the composer keyboard steady across the menu's lifecycle:
                    // close must not refocus the trigger (below), and open must not
                    // steal focus from the editor. Radix's DropdownMenu.Content TYPE
                    // omits onOpenAutoFocus (menus autofocus for keyboard nav by
                    // design), but the runtime composes it into its FocusScope — so
                    // it goes in through the type-level suppression below.
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    // Radix's DropdownMenu.Content type omits onOpenAutoFocus (menus autofocus for
                    // keyboard nav by design), but the runtime composes it into its FocusScope.
                    // @ts-expect-error -- see above
                    onOpenAutoFocus={(e: Event) => e.preventDefault()}
                >
                    <ScheduleSendMenu onSchedulePick={onSchedulePick} onScheduleSend={onScheduleSend} scheduleDisabled={scheduleDisabled} />
                </DropdownMenuContent>
            </DropdownMenu>
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
                aria-label={_("Send message")}
            >
                {/* While loading the Button shows its own spinner; don't also render content. */}
                {!loading && (
                    <>
                        <SendIcon />
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
                    <ScheduleSendMenu onSchedulePick={onSchedulePick} onScheduleSend={onScheduleSend} scheduleDisabled={scheduleDisabled} />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export default SendButton
