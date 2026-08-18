import { useRef, useState } from "react"
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
    disabled?: boolean
    /** Send is held while attachments finish uploading — show a spinner. */
    loading?: boolean
}

/**
 * Desktop: a split button — "Send" plus a chevron opening send options (currently just
 * "Send without notification"). Mobile: an icon-only round button; a long-press opens
 * the same options menu, a plain tap sends.
 */
const SendButton = ({ onSend, onSendSilently, onSendLoud, quietMode, disabled, loading }: SendButtonProps) => {
    const isMobile = useIsMobile()
    const [menuOpen, setMenuOpen] = useState(false)

    // Mobile: a long-press opens the send-options menu (shared hook — timer,
    // drag stand-down, haptic; the click that ends a fired press is consumed
    // in onClick below).
    const { handlers: longPressHandlers, consumeLongPress } = useLongPress(() => setMenuOpen(true))

    // Whether the menu was OPEN when this press started. A tap on the trigger
    // while the menu is showing is a DISMISS: Radix closes the menu on that
    // pointerdown, but the tap's click still lands on the send button — and
    // without this latch it would fire onSend (dismissing a menu must never
    // send). Captured at pointerdown, before Radix closes; consumed on click.
    const menuWasOpenAtPress = useRef(false)

    // Whatever the current default is, the menu offers the OPPOSITE. Normally
    // sends are loud and the menu offers silent; in quiet-hours "auto" mode
    // silent IS the default, so the menu offers the loud override — the urgent
    // late-night message stays one deliberate gesture away.
    const menuItem = quietMode === "auto" ? (
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

    // Quiet-hours "auto": a plain send WILL be silent, and that must be
    // visible before the tap — the send icon itself becomes the bell-off.
    // Nudge mode changes nothing here; the composer banner carries the hint.
    const autoSilent = quietMode === "auto"

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
                            // The click that ends the long-press itself.
                            if (consumeLongPress()) return
                            // A tap that dismissed the open menu (see the latch).
                            if (menuWasOpenAtPress.current) {
                                menuWasOpenAtPress.current = false
                                return
                            }
                            onSend()
                        }}
                        {...longPressHandlers}
                        // Latch the open state BEFORE arming — Radix closes the
                        // menu on this same pointerdown.
                        onPointerDown={(event) => {
                            menuWasOpenAtPress.current = menuOpen
                            longPressHandlers.onPointerDown(event)
                        }}
                        // Never steal focus from the editor: if the user is typing
                        // (keyboard open), tapping Send keeps it open naturally.
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={disabled}
                        variant="solid"
                        loading={loading}
                        isIconButton
                        className="rounded-full"
                        aria-label={autoSilent ? _("Send message silently") : _("Send message")}
                    >
                        {!loading && (autoSilent ? <BellOffIcon /> : <SendHorizontalIcon />)}
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
                    // it goes in through a cast.
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as object)}
                >
                    {menuItem}
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
                    {menuItem}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export default SendButton
