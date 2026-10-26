import { useMemo, useRef, useState, type PointerEvent } from "react"
import { fileSrc } from "@hooks/useFileSrc"
import { isMobileViewport } from "@hooks/use-mobile"
import { parseLocationJson } from "@lib/location"
import type { Message } from "@raven/types/common/Message"
import { androidMapsOption, installedIosMapsApps, iosMapsOptions, openExternal, openPlan, opensOnClick, webMapsOptions, type MapsOption } from "../../../../native/openMaps"
import { isNative, nativePlatform } from "../../../../native/platform"
import { LocationCard } from "./LocationCard"
import { MapsSheet, OpenInMapsMenu } from "./OpenInMapsMenu"

/** A Location message: the card plus the viewer's open-in-maps flow. */
export const MessageLocation = ({ message }: { message: Message }) => {
    // Parsed once per payload; MessageContent renders this for every visible card.
    const location = useMemo(() => parseLocationJson(message.json), [message.json])
    const file = message.message_type === "Location" ? message.file : undefined
    const snapshotUrl = file ? fileSrc(file) : undefined
    const pointerType = useRef<string | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuOptions, setMenuOptions] = useState<MapsOption[]>([])
    const [sheetOptions, setSheetOptions] = useState<MapsOption[] | null>(null)

    if (!location) {
        return (
            <div data-message-id={message.name}>
                <LocationCard meta={null} />
            </div>
        )
    }

    const openIos = async () => {
        const options = iosMapsOptions(location, await installedIosMapsApps())
        // A lone Apple Maps choice needs no sheet.
        if (options.length === 1) return openExternal(options[0].url, options[0].fallbackUrl)
        setSheetOptions(options)
    }

    const openMaps = () => {
        const plan = openPlan(isNative() ? nativePlatform() : "web", isMobileViewport())
        switch (plan) {
            case "geo": {
                const option = androidMapsOption(location)
                void openExternal(option.url, option.fallbackUrl)
                return
            }
            case "ios":
                void openIos()
                return
            case "sheet":
                setSheetOptions(webMapsOptions(location))
                return
            case "menu":
                setMenuOptions(webMapsOptions(location))
                setMenuOpen(true)
        }
    }

    const onOpenChange = (next: boolean) => {
        if (next) openMaps()
        else setMenuOpen(false)
    }

    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return
        pointerType.current = event.pointerType
        // Radix toggles on pointerdown; touch and pen wait for a completed tap.
        if (event.pointerType !== "mouse") event.preventDefault()
    }

    const onClick = () => {
        const pointer = pointerType.current
        pointerType.current = null
        if (opensOnClick(pointer)) openMaps()
    }

    const card = (
        <LocationCard meta={location} snapshotUrl={snapshotUrl} onOpen={onClick} onPointerDown={onPointerDown} />
    )

    return (
        <div data-message-id={message.name}>
            <OpenInMapsMenu trigger={card} options={menuOptions} open={menuOpen} onOpenChange={onOpenChange} />
            {sheetOptions && <MapsSheet options={sheetOptions} onClose={() => setSheetOptions(null)} />}
        </div>
    )
}
