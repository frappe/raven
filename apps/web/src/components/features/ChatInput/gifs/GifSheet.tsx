import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled"
import type { KlipyGif } from "@lib/klipy"
import _ from "@lib/translate"
import { GifPicker } from "./GifPicker"

/** Mobile: the GIF picker in a bottom sheet. A tap sends and closes it. */
export const GifSheet = ({ open, onOpenChange, onPick }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onPick: (gif: KlipyGif, query: string) => void
}) => {
    // Scrolling the grid must not drag the sheet down; a pull at its top still dismisses.
    const noDragProps = useNoDragWhileScrolled()

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="h-[75dvh]">
                <DrawerTitle className="sr-only">{_("GIFs")}</DrawerTitle>
                <DrawerDescription className="sr-only">{_("Search KLIPY and tap a GIF to send it")}</DrawerDescription>
                <div {...noDragProps} className="min-h-0 flex-1 px-3 pt-1 pb-2">
                    <GifPicker
                        onPick={(gif, query) => {
                            onOpenChange(false)
                            onPick(gif, query)
                        }}
                    />
                </div>
            </DrawerContent>
        </Drawer>
    )
}
