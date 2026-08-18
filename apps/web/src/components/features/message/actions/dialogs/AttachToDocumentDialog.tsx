import { useContext, useEffect, useMemo, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { FrappeConfig, FrappeContext, useFrappePostCall, type FrappeError } from "frappe-react-sdk"
import { toast } from "sonner"
import { DialogFooter } from "@components/ui/dialog"
import { ResponsiveDialog, ResponsiveDialogHeader } from "./ResponsiveDialog"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import { LinkFormField } from "@components/ui/form-elements"
import { errorResponseToast } from "@components/ui/error-banner"
import { channelMessagesStore } from "@stores/messages/store"
import { useRecentlyUsedDocType } from "@hooks/useRecentlyUsedDocType"
import { hasFile } from "../fileMessage"
import { MessagePreview } from "./MessagePreview"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"

type AttachForm = {
    doctype: string
    docname: string
}

/**
 * Files a message's attachment(s) against another document. One POST does the whole
 * job — the backend finds the File row for each message, checks write permission on
 * the target once, and attaches all of them (all-or-nothing). v2 ran the lookup
 * client-side and toasted success even when it found nothing.
 *
 * A batch (multi-file upload) shows a checklist, every member selected by default —
 * the same pattern DeleteMessageDialog uses, since each file in a batch is its own
 * Raven Message. A standalone message shows a single preview card.
 *
 * Mounted once by MessageActionDialogs and driven by messageDialogAtom; stays
 * mounted (open toggles) so it animates closed, with `message` held from the last
 * target so the body doesn't flash empty mid-animation.
 */
export const AttachToDocumentDialog = ({
    open,
    message,
    onClose,
}: {
    open: boolean
    message: Message | null
    onClose: () => void
}) => {
    const methods = useForm<AttachForm>({ defaultValues: { doctype: "", docname: "" } })
    const { control, handleSubmit, reset, setValue } = methods
    // useWatch, not watch: `watch` doesn't re-render on change, so the document field
    // would keep querying whichever doctype was selected before.
    const doctype = useWatch({ control, name: "doctype" })

    const { suggestedItems, addRecentlyUsedDocType } = useRecentlyUsedDocType()
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { call: attachFile, loading } = useFrappePostCall<{ message: string[] }>(
        "raven.api.raven_message.attach_file_to_document",
    )

    // A batch's loaded members (oldest-first), filtered to the file-bearing ones — a
    // captioned send appends its Text caption as the batch's LAST member, and it must
    // never show up as an attachable row (blank name/icon, no File row behind it) nor
    // be submitted in its file's place. Same predicate useMessageActions filters
    // through to gate this dialog's action in the first place.
    const members = useMemo(() => {
        if (!message) return []
        const batchMembers = message.message_batch_id
            ? channelMessagesStore.batchMembers(message.channel_id, message.message_batch_id)
            : [message]
        return batchMembers.filter(hasFile)
    }, [message?.name, message?.message_batch_id, message?.channel_id])
    const isBatch = members.length > 1

    // Selected ids — reset to "all" whenever the target changes (dialog stays mounted
    // for the open/close animation, so this can't live in useState initialisation).
    const [selected, setSelected] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (!message) return
        setSelected(new Set(members.map((member) => member.name)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message?.name])

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    // The dialog outlives any one target (it stays mounted for the close animation), so
    // the form resets on the OPEN transition rather than on mount or on message identity —
    // keying off `message?.name` alone left a reopen of the SAME message (attach → close →
    // reopen) prefilled with the previous doctype/docname and the Attach button enabled.
    useEffect(() => {
        if (open) reset({ doctype: "", docname: "" })
    }, [open, reset])

    // A docname is meaningless once the doctype changes underneath it.
    useEffect(() => {
        setValue("docname", "")
    }, [doctype, setValue])

    const onSubmit = async (data: AttachForm) => {
        if (!message) return
        // Preserve display order (oldest-first for a batch) — not selection order. Every
        // entry in `members` is already file-bearing (hasFile-filtered), so this is correct
        // for both a batch and a standalone (possibly captioned) single-file send.
        const ids = members.filter((member) => selected.has(member.name)).map((member) => member.name)
        if (ids.length === 0) return

        try {
            await attachFile({ message_ids: ids, doctype: data.doctype, docname: data.docname })
            addRecentlyUsedDocType(data.doctype)
            // Close right away — leaving the dialog open (with the Attach button re-enabled)
            // for the extra document_link.get round-trip below let a second click re-file
            // duplicates.
            onClose()
            // Resolve the document's URL server-side — Frappe CRM and friends don't live
            // under /app, and document_link.get is hook-overridable for exactly that.
            // with_site_url: false keeps it RELATIVE so it opens on whatever origin the
            // user is actually on. The absolute form is built from the site's configured
            // host_name, which is the deployed hostname — on a dev machine that sends you
            // to production.
            const link = await call
                .get<{ message: string }>("raven.api.document_link.get", {
                    doctype: data.doctype,
                    docname: data.docname,
                    with_site_url: false,
                })
                .then((response) => response.message)
                .catch(() => null)
            toast.success(_("Attached to {0}", [data.docname]), {
                action: link ? { label: _("View"), onClick: () => window.open(link, "_blank", "noopener,noreferrer") } : undefined,
            })
        } catch (error) {
            // Dialog stays open with the selection intact so a different document can be picked.
            errorResponseToast(_("Could not attach file"), error as FrappeError)
        }
    }

    return (
        <ResponsiveDialog open={open} onClose={onClose}>
            <FormProvider {...methods}>
                {/* min-w-0: DialogContent is a GRID, and a grid item defaults to
                    min-width:auto — it refuses to shrink below its own min-content. The
                    widest thing in here is the file card (a long filename) and the doctype
                    trigger, so on a narrow phone the form held itself wider than the dialog
                    and the surplus became a horizontal scroll (DialogContent's
                    overflow-y-auto promotes overflow-x to auto, so it scrolls rather than
                    clips). Letting the item shrink is what lets the truncation inside it
                    actually do its job. */}
                <form onSubmit={handleSubmit(onSubmit)} className="flex min-w-0 flex-col gap-4">
                    <ResponsiveDialogHeader
                        title={isBatch ? _("Attach files to document") : _("Attach file to document")}
                        description={_("The file stays on this message and is also attached to the document you pick.")}
                    />

                        {message &&
                            members.length > 0 &&
                            (isBatch ? (
                                /* overflow-x-hidden is deliberate, not redundant: overflow-y-auto
                                   alone promotes overflow-x from visible to auto, so a checklist
                                   that only ever needs to scroll DOWN would also scroll sideways
                                   the moment a filename didn't fit. */
                                <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
                                    {members.map((member) => (
                                        <label
                                            key={member.name}
                                            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-gray-2"
                                        >
                                            <Checkbox checked={selected.has(member.name)} onCheckedChange={() => toggle(member.name)} />
                                            <MessagePreview message={member} />
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 overflow-hidden rounded border border-outline-gray-2 px-2.5 py-2">
                                    <MessagePreview message={members[0]} />
                                </div>
                            ))}

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
                                placeholder={_("Select a document")}
                                rules={{ required: _("Document is required") }}
                            />
                        )}

                        {/* Mobile: 50/50 side by side rather than DialogFooter's stacked default —
                            the same treatment AlertDialogFooter gives the delete dialog, so the two
                            confirmations behave identically on a phone. Desktop is unchanged
                            (right-aligned row) since DialogFooter's own sm: classes still apply. */}
                        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" size="md" disabled={loading} onClick={onClose}>
                                {_("Cancel")}
                            </Button>
                            <Button type="submit" variant="solid" size="md" disabled={loading || selected.size === 0}>
                                {isBatch ? _("Attach ({0})", [String(selected.size)]) : _("Attach")}
                            </Button>
                        </DialogFooter>
                    </form>
            </FormProvider>
        </ResponsiveDialog>
    )
}
