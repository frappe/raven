import { formatCoordinates, type LocationMeta } from "@lib/location"
import _ from "@lib/translate"
import type { PositionFix } from "../../../../native/geolocation"

export type PickerPanel = { title: string; subtitle: string }

const wrapLongitude = (longitude: number): number => ((((longitude + 180) % 360) + 360) % 360) - 180

const PAN_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])

/** Leaflet pans the map by arrows; those moves must count as a drag. */
export const isPanKey = (key: string): boolean => PAN_KEYS.has(key)

/** Leaflet's unwrapped centre (e.g. 185) as coordinates the server accepts. */
export const centreOf = (latLng: { lat: number; lng: number }): LocationMeta => ({
    latitude: latLng.lat,
    longitude: wrapLongitude(latLng.lng),
})

/** The panel above the footer: the fix until the map moves, the pin's coordinates after. */
export const pickerPanel = ({
    centre,
    fix,
    dragged,
}: {
    centre: LocationMeta
    fix: PositionFix
    dragged: boolean
}): PickerPanel => {
    if (dragged) return { title: _("Send this location"), subtitle: formatCoordinates(centre) }
    return {
        title: _("Send your current location"),
        subtitle: _("Accurate to {0} m", [String(Math.round(fix.accuracy))]),
    }
}
