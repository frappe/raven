import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Crosshair, MapPin } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Drawer, DrawerActionBar, DrawerClose, DrawerContent, DrawerDescription } from "@components/ui/drawer"
import { useIsMobile } from "@hooks/use-mobile"
import type { LocationMeta } from "@lib/location"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { INITIAL_ZOOM, LocationMap, type MapHandle } from "./LocationMap"
import { MapNotice } from "./MapNotice"
import { pickerPanel, type PickerPanel } from "./pickerPanel"
import { type Snapshot } from "./snapshot"
import { useLocationFix } from "./useLocationFix"
import { usePickerSend } from "./usePickerSend"

const PickerSummary = ({ title, subtitle }: PickerPanel) => (
    <div className="flex items-center gap-2.5 px-4 py-3 md:px-0 md:py-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-gray-2 text-ink-red-6">
            <MapPin className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-ink-gray-8 md:text-sm">{title}</p>
            <p className="truncate text-sm text-ink-gray-5 md:text-xs">{subtitle}</p>
        </div>
    </div>
)

type LocationPickerContentProps = {
    isMobile: boolean
    onClose: () => void
    onSend: (location: LocationMeta, snapshot: Snapshot | null) => void
}

const LocationPickerContent = ({ isMobile, onClose, onSend }: LocationPickerContentProps) => {
    const { state, fix, retry } = useLocationFix()
    const mapRef = useRef<MapHandle>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [centre, setCentre] = useState<LocationMeta | null>(null)
    const [dragged, setDragged] = useState(false)

    const { send, sending } = usePickerSend({
        onSend,
        onClose,
        getLocation: () => {
            if (state !== "ready" || !fix || !centre) return null
            return mapRef.current?.getCentre() ?? { latitude: fix.latitude, longitude: fix.longitude }
        },
        getZoom: () => mapRef.current?.getZoom() ?? INITIAL_ZOOM,
    })

    // A new fix resets the map back to "current location".
    useEffect(() => {
        if (!fix) return
        setDragged(false)
        setCentre({ latitude: fix.latitude, longitude: fix.longitude })
    }, [fix])

    // Focus the body so Enter reaches the send handler instead of the close button.
    useEffect(() => {
        if (!isMobile) contentRef.current?.focus()
    }, [isMobile])

    const handleCentre = useCallback((next: LocationMeta) => setCentre(next), [])

    const handleRecenter = () => {
        setDragged(false)
        mapRef.current?.recenter()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" || (event.target as HTMLElement).closest("button")) return
        event.preventDefault()
        void send()
    }

    const ready = state === "ready" && !!fix
    const panel = ready && fix && centre ? pickerPanel({ centre, fix, dragged }) : null
    const canSend = ready && !!centre && !sending

    let mapArea
    if (state === "locating") {
        mapArea = <MapNotice isMobile={isMobile} spinner message={_("Finding your location…")} />
    } else if (state === "denied") {
        mapArea = (
            <MapNotice
                isMobile={isMobile}
                message={_("Location access is off. Turn it on in your browser or device settings.")}
                onRetry={retry}
            />
        )
    } else if (!ready || !fix) {
        mapArea = <MapNotice isMobile={isMobile} message={_("Couldn't find your location")} onRetry={retry} />
    } else {
        mapArea = (
            <div className="relative h-full w-full" data-vaul-no-drag>
                <LocationMap
                    ref={mapRef}
                    fix={fix}
                    isMobile={isMobile}
                    onCentre={handleCentre}
                    onDragStart={() => setDragged(true)}
                />
                <Button
                    variant="outline"
                    size={isMobile ? "lg" : "md"}
                    isIconButton
                    onClick={handleRecenter}
                    aria-label={_("Back to my location")}
                    className={cn(
                        "absolute right-2.5 bottom-7 z-700 rounded-full shadow",
                        dragged ? "text-ink-gray-6" : "text-ink-blue-6",
                    )}
                >
                    <Crosshair />
                </Button>
            </div>
        )
    }

    const sendButton = (
        <Button
            className={isMobile ? "w-full" : undefined}
            size={isMobile ? "lg" : "md"}
            onClick={() => void send()}
            loading={sending}
            disabled={!canSend}
        >
            {_("Send location")}
        </Button>
    )

    if (isMobile) {
        return (
            <>
                <DrawerActionBar
                    title={_("Share location")}
                    leading={
                        <DrawerClose asChild>
                            <Button variant="ghost" size="md">
                                {_("Cancel")}
                            </Button>
                        </DrawerClose>
                    }
                />
                <DrawerDescription className="sr-only">
                    {_("Drag the map to pick a spot, then send it.")}
                </DrawerDescription>
                <div className="min-h-0 flex-1">{mapArea}</div>
                {panel && <PickerSummary {...panel} />}
                <div className="px-4 pt-2 pb-3">{sendButton}</div>
            </>
        )
    }

    return (
        <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-4 outline-none" onKeyDown={handleKeyDown}>
            <DialogHeader>
                <DialogTitle>{_("Share location")}</DialogTitle>
                <DialogDescription className="sr-only">
                    {_("Drag the map to pick a spot, then send it.")}
                </DialogDescription>
            </DialogHeader>
            <div className="-mx-6 h-80">{mapArea}</div>
            {panel && <PickerSummary {...panel} />}
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" size="md">
                        {_("Cancel")}
                    </Button>
                </DialogClose>
                {sendButton}
            </DialogFooter>
        </div>
    )
}

type LocationPickerProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSend: (location: LocationMeta, snapshot: Snapshot | null) => void
}

/** A map centred on the device, with a draggable pin; sends only the centre's coordinates. */
export const LocationPicker = ({ open, onOpenChange, onSend }: LocationPickerProps) => {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                {open && (
                    <DrawerContent
                        className="h-dvh max-h-dvh rounded-none border-0 pt-[var(--inset-top)]"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                        <LocationPickerContent
                            isMobile
                            onClose={() => onOpenChange(false)}
                            onSend={onSend}
                        />
                    </DrawerContent>
                )}
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && (
                <DialogContent>
                    <LocationPickerContent
                        isMobile={false}
                        onClose={() => onOpenChange(false)}
                        onSend={onSend}
                    />
                </DialogContent>
            )}
        </Dialog>
    )
}
