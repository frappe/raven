import { useMemo, useRef, useState } from "react"
import { fileSrc } from "@hooks/useFileSrc"
import { isMobileViewport } from "@hooks/use-mobile"
import { parseLocationJson } from "@lib/location"
import type { Message } from "@raven/types/common/Message"
import { androidMapsOption, installedIosMapsApps, iosMapsOptions, openExternal, openPlan, webMapsOptions, type MapsOption } from "../../../../native/openMaps"
import { isNative, nativePlatform } from "../../../../native/platform"
import { LocationCard } from "./LocationCard"
import { MapsSheet, OpenInMapsMenu } from "./OpenInMapsMenu"

/** A Location message: the card plus the viewer's open-in-maps flow. */
export const MessageLocation = ({ message }: { message: Message }) => {
    // Parsed once per payload; MessageContent renders this for every visible card.
    const location = useMemo(() => parseLocationJson(message.json), [message.json])
    const file = message.message_type === "Location" ? message.file : undefined
    const snapshotUrl = file ? fileSrc(file) : undefined
    const cardRef = useRef<HTMLButtonElement>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [sheetOptions, setSheetOptions] = useState<MapsOption[] | null>(null)

    if (!location) {
        return (
            <div data-message-id={message.name}>
                <LocationCard />
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
                setMenuOpen(true)
        }
    }

    return (
        <div data-message-id={message.name} className="relative">
            <LocationCard ref={cardRef} snapshotUrl={snapshotUrl} onOpen={openMaps} />
            {menuOpen && (
                <OpenInMapsMenu
                    options={webMapsOptions(location)}
                    onClose={() => setMenuOpen(false)}
                    onCloseAutoFocus={() => cardRef.current?.focus()}
                />
            )}
            {sheetOptions && <MapsSheet options={sheetOptions} onClose={() => setSheetOptions(null)} />}
        </div>
    )
}
