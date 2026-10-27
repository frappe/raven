import { useState } from "react"
import { PinMarker } from "@components/common/PinMarker"
import { formatCoordinates } from "@lib/location"
import { mapLinkDetails, mapPreviewImage, type MapProvider } from "@lib/mapLinks"
import _ from "@lib/translate"
import { useLinkPreview } from "@stores/linkPreviews/useLinkPreview"
import { MAPS_BRAND } from "./BrandIcons"
import { LinkActionCard } from "./LinkActionCard"

/** A Google or Apple map link as a Meet-style card with its map snapshot. */
export const MapLinkCard = ({ href, provider }: { href: string; provider: MapProvider }) => {
    const preview = useLinkPreview(href)
    const [failedImage, setFailedImage] = useState<string | null>(null)
    const title = preview?.status === "Fetched" ? preview.title : undefined
    const { name, address, coordinates } = mapLinkDetails(href, provider, title)
    const image = preview?.status === "Fetched" ? mapPreviewImage(provider, preview) : null
    const showImage = !!image && image !== failedImage
    const label = name ?? (provider === "google" ? _("Google Maps") : _("Apple Maps"))
    const coordinateText = coordinates ? formatCoordinates(coordinates) : null
    const detail = address ?? coordinateText
    return (
        <LinkActionCard
            href={href}
            brand={MAPS_BRAND[provider]}
            label={label}
            detail={detail ?? undefined}
            actionLabel={_("View")}
            copiedMessage={detail && detail === coordinateText ? _("Copied coordinates") : _("Copied address")}
            media={
                showImage ? (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={_("View on map")}
                        className="relative block aspect-3/2 w-full bg-surface-gray-2"
                    >
                        <img
                            src={image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 size-full object-cover"
                            onError={() => setFailedImage(image)}
                        />
                        {provider === "google" && <PinMarker />}
                    </a>
                ) : undefined
            }
        />
    )
}
