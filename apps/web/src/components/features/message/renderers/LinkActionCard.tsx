import type { ReactNode } from "react"
import { Button } from "@components/ui/button"
import { useCopyToClipboard } from "usehooks-ts"
import { toast } from "sonner"
import { BrandIcon, type BrandSpec } from "./BrandIcons"

type LinkActionCardProps = {
    href: string
    brand: BrandSpec
    label: string
    detail?: string
    actionLabel: string
    copiedMessage: string
    /** Optional image above the row (map-link snapshots). */
    media?: ReactNode
}

/**
 * A link card with a brand glyph, a title, an optional copyable detail and an
 * action button. Used by meeting links and map links.
 */
export const LinkActionCard = ({
    href,
    brand,
    label,
    detail,
    actionLabel,
    copiedMessage,
    media,
}: LinkActionCardProps) => {
    const [, copy] = useCopyToClipboard()

    const handleCopy = () => {
        if (!detail) return
        copy(detail)
        toast.success(copiedMessage)
    }
    return <div data-media-root="" className="w-full sm:max-w-sm max-w-xs my-2">
        <div className="flex flex-col overflow-hidden rounded-md border border-outline-gray-2 bg-surface-gray-1 dark:bg-surface-elevation-2">
            {media}
            <div className="flex items-center gap-3 p-3">
                <BrandIcon brand={brand} className="shrink-0 size-9" />
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-base-medium text-ink-gray-9">{label}</div>
                    {detail && (
                        <div className="truncate text-sm leading-snug text-ink-gray-6 cursor-pointer" onClick={handleCopy} role="button" tabIndex={0}>{detail}</div>
                    )}
                </div>
                <Button asChild variant="subtle" size="md" className="shrink-0">
                    <a href={href} target="_blank" rel="noopener noreferrer">{actionLabel}</a>
                </Button>
            </div>
        </div>
    </div>
}
