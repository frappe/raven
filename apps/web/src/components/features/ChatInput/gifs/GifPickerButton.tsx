import { useRef, useState } from "react"
import { ImagePlayIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { preconnectKlipy, type KlipyGif } from "@lib/klipy"
import _ from "@lib/translate"
import { GifPicker } from "./GifPicker"

/** Desktop composer toolbar: the GIF picker in a popover. A pick sends and closes it. */
export const GifPickerButton = ({ onPick }: { onPick: (gif: KlipyGif, query: string) => void }) => {
    const [open, setOpen] = useState(false)
    const picked = useRef(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        {/* Hover or focus is a likely click: open KLIPY's connections now. */}
                        <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("GIF")} onPointerEnter={preconnectKlipy} onFocus={preconnectKlipy}>
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
                <GifPicker
                    onPick={(gif, query) => {
                        picked.current = true
                        setOpen(false)
                        onPick(gif, query)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
