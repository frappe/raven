import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import type { Circle, Map as LeafletMap, Marker } from "leaflet"
import { PinMarker } from "@components/common/PinMarker"
import { cn } from "@lib/utils"
import { Spinner } from "@components/ui/spinner"
import { MAP_ATTRIBUTION_HTML, MAP_TILE_URL, type LocationMeta } from "@lib/location"
import _ from "@lib/translate"
import type { PositionFix } from "../../../../native/geolocation"
import { MapNotice } from "./MapNotice"
import { centreOf, isPanKey } from "./pickerPanel"

export type MapHandle = { recenter(): void; getCentre(): LocationMeta; getZoom(): number }

type LocationMapProps = {
    fix: PositionFix
    isMobile: boolean
    onCentre: (centre: LocationMeta) => void
    onDragStart: () => void
    ref: Ref<MapHandle>
}

export const INITIAL_ZOOM = 17
// No default marker images: a plain DOM dot, sized by CSS.
const FIX_DOT_HTML = `<div style="width:14px;height:14px;border-radius:9999px;background:var(--ink-blue-6);border:2px solid var(--white);box-shadow:var(--elevation-sm)"></div>`

/** Leaflet is imported on demand, so it stays out of the composer bundle. */
export const LocationMap = ({ fix, isMobile, onCentre, onDragStart, ref }: LocationMapProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<LeafletMap | null>(null)
    const leafletRef = useRef<typeof import("leaflet") | null>(null)
    const centreRef = useRef(onCentre)
    const dragStartRef = useRef(onDragStart)
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
    const [attempt, setAttempt] = useState(0)
    const [moving, setMoving] = useState(false)

    useEffect(() => {
        centreRef.current = onCentre
    }, [onCentre])

    useEffect(() => {
        dragStartRef.current = onDragStart
    }, [onDragStart])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let disposed = false
        let map: LeafletMap | null = null
        let observer: ResizeObserver | null = null
        setStatus("loading")

        const readCentre = () => centreOf(map?.getCenter().wrap() ?? { lat: 0, lng: 0 })
        const handleMoveStart = () => setMoving(true)
        const handleMoveEnd = () => {
            setMoving(false)
            centreRef.current(readCentre())
        }

        const setup = async () => {
            try {
                const L = await import("leaflet")
                await import("leaflet/dist/leaflet.css")
                if (disposed) return
                leafletRef.current = L
                map = L.map(container, {
                    zoomControl: false,
                    attributionControl: true,
                    // Zoom around the centre: the pin must not drift off the fix.
                    scrollWheelZoom: "center",
                    touchZoom: "center",
                    doubleClickZoom: "center",
                    boxZoom: false,
                    // Caps a fling's glide at ~265 px; Leaflet's default is unbounded.
                    inertiaMaxSpeed: 600,
                })
                map.attributionControl.setPrefix(false)
                L.tileLayer(MAP_TILE_URL, {
                    attribution: MAP_ATTRIBUTION_HTML,
                    crossOrigin: true,
                    maxZoom: 19,
                }).addTo(map)
                map.setView([fix.latitude, fix.longitude], INITIAL_ZOOM)
                map.on("dragstart", () => dragStartRef.current())
                map.on("keydown", (event) => {
                    if (isPanKey(event.originalEvent.key)) dragStartRef.current()
                })
                map.on("movestart", handleMoveStart)
                map.on("moveend", handleMoveEnd)
                // An animated dialog hands Leaflet a zero-sized box; remeasure as it settles.
                observer = new ResizeObserver(() => map?.invalidateSize())
                observer.observe(container)
                mapRef.current = map
                setStatus("ready")
            } catch {
                map?.remove()
                map = null
                mapRef.current = null
                leafletRef.current = null
                if (!disposed) setStatus("failed")
            }
        }

        void setup()

        return () => {
            disposed = true
            observer?.disconnect()
            map?.remove()
            map = null
            mapRef.current = null
            leafletRef.current = null
        }
        // The map is rebuilt only on retry; a new fix only swaps the dot and accuracy circle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt])

    useEffect(() => {
        const L = leafletRef.current
        const map = mapRef.current
        if (status !== "ready" || !L || !map) return
        const point: [number, number] = [fix.latitude, fix.longitude]
        const dot: Marker = L.marker(point, {
            icon: L.divIcon({ className: "", html: FIX_DOT_HTML, iconSize: [14, 14] }),
            interactive: false,
        }).addTo(map)
        const accuracy: Circle = L.circle(point, {
            radius: fix.accuracy,
            className: "stroke-ink-blue-6 fill-ink-blue-6",
            weight: 1,
            fillOpacity: 0.12,
        }).addTo(map)
        return () => {
            dot.remove()
            accuracy.remove()
        }
    }, [fix, status])

    useImperativeHandle(
        ref,
        () => ({
            recenter: () => {
                const map = mapRef.current
                if (!map) return
                map.setView([fix.latitude, fix.longitude], map.getZoom())
            },
            getCentre: () => {
                const map = mapRef.current
                return map
                    ? centreOf(map.getCenter().wrap())
                    : centreOf({ lat: fix.latitude, lng: fix.longitude })
            },
            getZoom: () => mapRef.current?.getZoom() ?? INITIAL_ZOOM,
        }),
        [fix],
    )

    return (
        <div className="relative h-full w-full bg-surface-gray-2">
            <div ref={containerRef} className="absolute inset-0" />
            {status === "ready" && (
                <>
                    {/* The lifted pin's shadow marks where it will drop; it fades with the pin's 150 ms drop. */}
                    <span
                        className={cn(
                            "pointer-events-none absolute left-1/2 top-1/2 z-700 h-1 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black-300 blur-[1px] transition-opacity duration-150",
                            moving ? "opacity-100" : "opacity-0",
                        )}
                    />
                    <PinMarker lifted={moving} className="z-700" />
                </>
            )}
            {status === "loading" && (
                <div className="absolute inset-0 z-700 flex items-center justify-center">
                    <Spinner size="lg" />
                </div>
            )}
            {status === "failed" && (
                <div className="absolute inset-0 z-800">
                    <MapNotice
                        isMobile={isMobile}
                        message={_("Couldn't load the map")}
                        onRetry={() => setAttempt((count) => count + 1)}
                    />
                </div>
            )}
        </div>
    )
}
