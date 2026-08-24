import { useEffect, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useSetAtom, useAtomValue } from 'jotai'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { FileBoxIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@components/ui/dialog'
import { LinkFormField } from '@components/ui/form-elements'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'
import { useIsMobile } from '@hooks/use-mobile'
import { useRecentlyUsedDocType } from '@hooks/useRecentlyUsedDocType'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@components/ui/hover-card'
import { DocumentPreviewSummary, documentPreviewSwrKey } from '@components/features/message/renderers/DocumentLinkRenderer'
import { linkedDocumentAtom, type LinkedDocument } from '@utils/channelAtoms'
import _ from '@lib/translate'

type AttachDocumentForm = {
    doctype: string
    docname: string
}

interface AttachFrappeDocumentDialogProps {
    channelID: string
    /** Controlled open state — omit for the default self-managed icon-trigger mode. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Hide the built-in icon trigger when an external control (e.g. mobile sheet) opens this. */
    hideTrigger?: boolean
}

/**
 * Attach a system document to the draft. Picking one stages it on the
 * channel's linkedDocumentAtom and shows a preview chip in the composer.
 * The document rides the next send like a file attachment. Text and files
 * can still go with it. One document per message: attaching again replaces
 * the staged one.
 */
const AttachFrappeDocumentDialog = ({ channelID, open, onOpenChange, hideTrigger }: AttachFrappeDocumentDialogProps) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = open ?? internalOpen
    const setOpen = onOpenChange ?? setInternalOpen

    const setLinkedDocument = useSetAtom(linkedDocumentAtom(channelID))
    const { suggestedItems, addRecentlyUsedDocType } = useRecentlyUsedDocType()

    const methods = useForm<AttachDocumentForm>({ defaultValues: { doctype: '', docname: '' } })
    const { control, handleSubmit, reset, setValue } = methods
    const doctype = useWatch({ control, name: 'doctype' })
    const docname = useWatch({ control, name: 'docname' })

    // Fresh pickers every time the dialog opens — the previous pick is already
    // staged (or was abandoned), so prefilling it only invites double-attaches.
    useEffect(() => {
        if (isOpen) reset({ doctype: '', docname: '' })
    }, [isOpen, reset])

    // A docname is meaningless once the doctype changes underneath it.
    useEffect(() => {
        setValue('docname', '')
    }, [doctype, setValue])

    const onSubmit = (data: AttachDocumentForm) => {
        setLinkedDocument({ doctype: data.doctype, docname: data.docname })
        addRecentlyUsedDocType(data.doctype)
        setOpen(false)
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
                                aria-label={_("Attach document from other apps")}
                            >
                                <FileBoxIcon />
                            </Button>
                        </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        {_("Attach document from other apps")}
                    </TooltipContent>
                </Tooltip>
            )}
            <DialogContent>
                <FormProvider {...methods}>
                    {/* stopPropagation is load-bearing. This dialog lives inside
                        ChatInput's own form in the REACT tree (the portal doesn't
                        matter to synthetic events), so a bubbled submit would run
                        handleSend and fire the draft before the document stages. */}
                    <form
                        onSubmit={(event) => {
                            event.stopPropagation()
                            handleSubmit(onSubmit)(event)
                        }}
                        className="flex min-w-0 flex-col gap-4"
                    >
                        <DialogHeader>
                            <DialogTitle>{_("Attach document from other apps")}</DialogTitle>
                            <DialogDescription>{_("Choose a document from the system to send with your message.")}</DialogDescription>
                        </DialogHeader>

                        <LinkFormField
                            name="doctype"
                            label={_("Document Type")}
                            isRequired
                            doctype="DocType"
                            suggestedItems={suggestedItems}
                            filters={[
                                ["issingle", "=", 0],
                                ["istable", "=", 0],
                            ]}
                            rules={{ required: _("Document Type is required") }}
                        />

                        {doctype && (
                            <LinkFormField
                                name="docname"
                                label={_("Document")}
                                isRequired
                                doctype={doctype}
                                rules={{ required: _("Document is required") }}
                            />
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                {_("Cancel")}
                            </Button>
                            <Button type="submit" disabled={!doctype || !docname}>
                                {_("Attach")}
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    )
}

/**
 * The staged document's preview chip in the composer (rendered next to the
 * file list). Fetches the document's title through the SAME cache key the
 * message card uses — so the card after send renders without a second fetch.
 */
export const LinkedDocumentBanner = ({ channelID }: { channelID: string }) => {
    const linkedDocument = useAtomValue(linkedDocumentAtom(channelID))
    if (!linkedDocument) return null
    return <LinkedDocumentChip channelID={channelID} document={linkedDocument} />
}

const LinkedDocumentChip = ({ channelID, document }: { channelID: string; document: LinkedDocument }) => {
    const setLinkedDocument = useSetAtom(linkedDocumentAtom(channelID))
    const isMobile = useIsMobile()
    // Title lookup — pre-warms the exact SWR entry DocumentLinkRenderer reads
    // (shared key helper), with the same revalidation behavior as the card.
    const { data } = useFrappeGetCall<{ message: { preview_title?: string } | null }>(
        "raven.api.document_link.get_preview_data",
        { doctype: document.doctype, docname: document.docname },
        documentPreviewSwrKey(document.doctype, document.docname),
        { dedupingInterval: 10000, focusThrottleInterval: 5000, shouldRetryOnError: false },
    )
    const title = data?.message?.preview_title || document.docname

    // Same pill anatomy as InputFiles' FileItem: bordered box, icon, two-line
    // label (title over doctype), trailing remove button. The wrapper paddings
    // match InputFileList's strip exactly — on mobile the gap sits BELOW the
    // pill (above the input row), on desktop above it.
    return (
        <div className="px-2 md:pt-2 pt-0 pb-2 md:pb-0">
            <div className="rounded-md border border-outline-gray-2 md:w-64 w-full">
                <div className="flex items-center gap-2 p-2">
                    {/* Hovering previews the full document (title + fields) — the
                        same data the sent card will show, already in the SWR cache. */}
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <div className="shrink-0">
                                    <FileBoxIcon className={isMobile ? "size-7 text-ink-gray-6" : "size-6 text-ink-gray-6"} aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="md:text-xs-medium mb-0.5 text-sm-medium leading-snug text-ink-gray-8 truncate">
                                        {title}
                                    </h4>
                                    <p className="md:text-xs text-sm text-ink-gray-5 truncate">{document.doctype}</p>
                                </div>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="start" className="w-96 max-w-[90vw]">
                            <DocumentPreviewSummary doctype={document.doctype} docname={document.docname} />
                        </HoverCardContent>
                    </HoverCard>
                    <div className="flex size-9 items-center justify-center">
                        <Button
                            type="button"
                            variant="ghost"
                            size={isMobile ? "lg" : "sm"}
                            isIconButton
                            title={_("Remove document")}
                            onClick={() => setLinkedDocument(null)}
                        >
                            <Trash2Icon />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AttachFrappeDocumentDialog
