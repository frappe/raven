import { useRef, useState } from "react"
import { ImagePlayIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { getKlipyConfig, preconnectKlipy, type KlipyGif } from "@lib/klipy"
import _ from "@lib/translate"
import { GifPicker } from "./GifPicker"
import { GifSetupNotice } from "./GifSetupNotice"

/**
 * Desktop composer toolbar: the GIF picker in a popover. A pick sends and closes it.
 * Shown even without a KLIPY key, so admins find where to turn GIFs on.
 */
export const GifPickerButton = ({ onPick }: { onPick: (gif: KlipyGif, query: string) => void }) => {
    const [open, setOpen] = useState(false)
    const picked = useRef(false)
    // Read on open as well: an admin can add the key from another composer's popover.
    const [enabled, setEnabled] = useState(() => !!getKlipyConfig())
    const preconnect = enabled ? preconnectKlipy : undefined

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (next) setEnabled(!!getKlipyConfig())
                setOpen(next)
            }}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        {/* Hover or focus is a likely click: open KLIPY's connections now. */}
                        <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("GIF")} onPointerEnter={preconnect} onFocus={preconnect}>
                            <ImagePlayIcon />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{_("GIF")}</TooltipContent>
            </Tooltip>
            <PopoverContent
                side="top"
                align="start"
                className="h-[27rem] w-[22rem] border-0 p-3"
                // After a pick, focus stays in the composer (onPick put it there); Escape returns it to this button.
                onCloseAutoFocus={(e) => {
                    if (picked.current) e.preventDefault()
                    picked.current = false
                }}
            >
                {enabled ? (
                    <GifPicker
                        onPick={(gif, query) => {
                            picked.current = true
                            setOpen(false)
                            onPick(gif, query)
                        }}
                    />
                ) : (
                    <GifSetupNotice onEnabled={() => setEnabled(true)} />
                )}
            </PopoverContent>
        </Popover>
    )
}
