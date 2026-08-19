import { lazy, Suspense } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@components/ui/dialog'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@components/ui/drawer'
import { Spinner } from '@components/ui/spinner'
import { useIsMobile } from '@hooks/use-mobile'
import _ from '@lib/translate'

// The form (react-hook-form, member search, stepper) is only needed once the
// dialog opens — load it on demand instead of shipping it in the main bundle
// (same pattern as CreatePollDialog).
const CreateChannelForm = lazy(() => import('./CreateChannelForm').then((m) => ({ default: m.CreateChannelForm })))

const fallback = (
    <div className="flex h-64 items-center justify-center">
        <Spinner />
    </div>
)

/**
 * Controlled create-channel surface (dialog on desktop, drawer on mobile).
 * Opened from the sidebar's ellipsis menu — there is no standalone button.
 *
 * The title + description live HERE, in the surface's own primitives (Dialog*
 * on desktop, Drawer* on mobile) — NOT in the lazy form: Radix checks for them
 * when the surface mounts, and during the Suspense fallback the form doesn't
 * exist yet.
 */
export const CreateChannelDialog = ({
    open,
    onOpenChange,
    selectedWorkspace,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Pre-scope the new channel to this workspace. Callers OUTSIDE a
     *  workspace route (the settings dialog's Channels panel) must pass it —
     *  the form's fallback is the ROUTE's workspace, which is absent on
     *  routes like /threads (channel creation would post an empty workspace)
     *  and wrong when the panel is filtered to a different workspace. */
    selectedWorkspace?: string
}) => {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="max-h-[90vh]">
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-4">
                        <DrawerTitle className="text-left text-2xl-semibold text-ink-gray-9">{_('Create Channel')}</DrawerTitle>
                        <DrawerDescription className="sr-only">
                            {_('Choose a name and type for your channel, then add members.')}
                        </DrawerDescription>
                        <Suspense fallback={fallback}>
                            <CreateChannelForm onClose={() => onOpenChange(false)} selectedWorkspace={selectedWorkspace} />
                        </Suspense>
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-170">
                <DialogHeader>
                    <DialogTitle>{_('Create Channel')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {_('Choose a name and type for your channel, then add members.')}
                    </DialogDescription>
                </DialogHeader>
                <Suspense fallback={fallback}>
                    <CreateChannelForm onClose={() => onOpenChange(false)} selectedWorkspace={selectedWorkspace} />
                </Suspense>
            </DialogContent>
        </Dialog>
    )
}
