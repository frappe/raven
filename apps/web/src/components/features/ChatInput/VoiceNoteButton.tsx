import { Mic } from "lucide-react"
import { Button } from "@components/ui/button"
import { useLongPress } from "@hooks/useLongPress"
import { unlockAudioContext } from "@lib/audioContext"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { DesktopTooltip } from "./DesktopTooltip"

type VoiceNoteButtonProps = {
    onRecord: () => void
    /** Mobile: a held press records until release. */
    onHold?: () => void
    size?: "sm" | "lg"
    variant?: "ghost" | "solid"
}

export const VoiceNoteButton = ({ onRecord, onHold, size = "sm", variant = "ghost" }: VoiceNoteButtonProps) => {
    // The recording start plays the haptic, for a tap and a hold alike.
    const { handlers, consumeLongPress } = useLongPress(() => onHold?.(), { haptic: false })
    return (
        <DesktopTooltip label={_("Record voice note")}>
            <Button
                variant={variant}
                size={size}
                isIconButton
                type="button"
                // No OS selection or callout on the hold.
                className={cn(size === "lg" && "rounded-full", onHold && "select-none [-webkit-touch-callout:none]")}
                aria-label={_("Record voice note")}
                // Don't take focus: on mobile that would open the keyboard.
                onMouseDown={(event) => event.preventDefault()}
                {...(onHold && {
                    ...handlers,
                    onPointerDown: (event: React.PointerEvent) => {
                        // The hold starts from a timer, outside the gesture iOS needs to start audio.
                        unlockAudioContext()
                        handlers.onPointerDown(event)
                    },
                })}
                onClick={() => {
                    // The click that ends a hold.
                    if (consumeLongPress()) return
                    onRecord()
                }}
            >
                <Mic />
            </Button>
        </DesktopTooltip>
    )
}
