import { mapPreviewImage, type MapProvider } from "@lib/mapLinks"
import { useLinkPreview } from "@stores/linkPreviews/useLinkPreview"
import { openExternal } from "../../../../native/openMaps"
import { LocationCard } from "./LocationCard"

/** A Google or Apple map link as the image-only map card, or the placeholder when it has no usable image. */
export const MapLinkCard = ({ href, provider }: { href: string; provider: MapProvider }) => {
    const preview = useLinkPreview(href)
    const image = preview?.status === "Fetched" ? mapPreviewImage(provider, preview) : null
    return (
        <div data-media-root="" className="my-2">
            <LocationCard
                snapshotUrl={image?.url}
                aspect={image?.aspect}
                pin={provider === "google"}
                fit="contain"
                onOpen={() => void openExternal(href)}
            />
        </div>
    )
}
