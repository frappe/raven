import { Dialog as DialogPrimitive } from "radix-ui"

/**
 * Full-viewport media lightbox (images, PDFs) — Google-Drive style: a dark
 * scrim with the content filling the screen and chrome floating over it,
 * rather than a bounded card. A deliberate surface exception to the card
 * modal system: for media viewing the content is the point, not the frame.
 *
 * Forces `dark`, so the floating MediaPreviewHeader's semantic tokens (ink /
 * surface) render light over the scrim with no overlay-specific styling, and
 * the lightbox stays dark regardless of the app's theme.
 */
export const MediaLightbox = ({
    open,
    onOpenChange,
    title,
    overlayRef,
    children,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Accessible name for the dialog (screen readers); rendered sr-only. */
    title: string
    /** Scrim handle for the swipe-down-to-close backdrop fade (direct style writes, no state). */
    overlayRef?: React.Ref<HTMLDivElement>
    children: React.ReactNode
}) => (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
            {/* transition-opacity: the dismiss drag writes inline opacity per move —
                the transition smooths the steps and animates the restore to "" */}
            <DialogPrimitive.Overlay
                ref={overlayRef}
                className="fixed inset-0 z-50 bg-black-900 transition-opacity duration-150 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            />
            <DialogPrimitive.Content
                aria-describedby={undefined}
                // Keep initial focus off the action buttons — they read as pre-selected
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="dark fixed inset-0 z-50 flex flex-col text-ink-gray-8 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            >
                <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                {children}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
)
