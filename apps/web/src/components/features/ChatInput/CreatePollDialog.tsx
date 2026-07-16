import { lazy, Suspense, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Button } from '@components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@components/ui/dialog'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@components/ui/tooltip'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@components/ui/drawer'
import { Spinner } from '@components/ui/spinner'
import { useIsMobile } from '@hooks/use-mobile'
import _ from '@lib/translate'

// The poll form (date picker, selects, form-elements) is only needed once the dialog
// opens, so load it on demand rather than in the composer bundle.
const CreatePollForm = lazy(() => import('./CreatePollForm').then((m) => ({ default: m.CreatePollForm })))

interface CreatePollDialogProps {
    channelID: string
    /** Controlled open state — omit for the default self-managed icon-trigger mode. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Hide the built-in icon trigger when an external control (e.g. mobile sheet) opens this. */
    hideTrigger?: boolean
}

export const CreatePollDialog = ({ channelID, open, onOpenChange, hideTrigger }: CreatePollDialogProps) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = open ?? internalOpen
    const setOpen = onOpenChange ?? setInternalOpen
    const isMobile = useIsMobile()

    // Mobile: a bottom drawer (opened from the composer sheet — no trigger of its own)
    if (isMobile) {
        return (
            <Drawer open={isOpen} onOpenChange={setOpen}>
                <DrawerContent>
                    {/* Title/description live HERE (not in the lazy form): Radix checks
                        for them at mount, and during the Suspense fallback the form —
                        and any header inside it — doesn't exist yet. */}
                    <div className="max-h-[85vh] overflow-y-auto px-4 pb-4">
                        <DrawerTitle className="pt-1 text-left text-2xl-semibold">{_('Create Poll')}</DrawerTitle>
                        <DrawerDescription className="sr-only">{_('Ask a question and add options for people to vote on.')}</DrawerDescription>
                        <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner /></div>}>
                            <CreatePollForm channelID={channelID} onClose={() => setOpen(false)} />
                        </Suspense>
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {!hideTrigger && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_("Create a poll")}
                            >
                                <BarChart3 />
                            </Button>
                        </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {_("Create a poll")}
                    </TooltipContent>
                </Tooltip>
            )}
            <DialogContent>
                {/* Header lives HERE, outside Suspense — see the drawer branch note */}
                <DialogHeader>
                    <DialogTitle>{_('Create Poll')}</DialogTitle>
                    <DialogDescription className="sr-only">{_('Ask a question and add options for people to vote on.')}</DialogDescription>
                </DialogHeader>
                <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner /></div>}>
                    <CreatePollForm channelID={channelID} onClose={() => setOpen(false)} />
                </Suspense>
            </DialogContent>
        </Dialog>
    )
}

