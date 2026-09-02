import { useState, type ReactNode } from "react"
import { useFrappeCreateDoc, useFrappeFileUpload } from "frappe-react-sdk"
import { useForm, type DefaultValues, type FieldValues, type UseFormProps, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@components/ui/dialog"
import ErrorBanner from "@components/ui/error-banner"
import { FileDropzone } from "@components/ui/file-dropzone"
import { Form } from "@components/ui/form"
import { Spinner } from "@components/ui/spinner"
import _ from "@lib/translate"

type UploadDocDialogProps<T extends FieldValues> = {
    doctype: string
    /** Upload fieldname; the created doc gets the file URL under this key. */
    fileField: string
    /** Defaults to private — an upload with no stated intent should not be world-readable. */
    isPrivate?: boolean
    accept?: Record<string, string[]>
    /** Oversized picks are rejected with a toast. */
    maxBytes?: number
    title: string
    description: string
    submitLabel?: string
    submitBusyLabel?: string
    defaults: DefaultValues<T>
    /** react-hook-form validation mode. */
    mode?: UseFormProps<T>["mode"]
    /** Form fields, rendered inside the dialog's FormProvider. */
    children: ReactNode
    /** Helper text under the dropzone. */
    hint?: ReactNode
    /** Seed form fields from the picked file (e.g. a name); cleared fields are the caller's job on `null`. */
    onFilePicked?: (file: File | null, form: UseFormReturn<T>) => void
    /** Pre-upload gate (e.g. duplicate check). Return false to abort — set form errors yourself. */
    beforeUpload?: (data: T, form: UseFormReturn<T>) => Promise<boolean>
    /** Docname the file is uploaded against. Defaults to a timestamped placeholder. */
    docname?: (data: T) => string
    onCreated: (doc: T & { name: string }) => void | Promise<void>
    /** Uncontrolled shell: custom trigger (defaults to a primary button with the title). */
    trigger?: ReactNode
    /** Controlled shell: pass both to own the open state; `trigger` is ignored. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

/** Dialog that uploads one file and creates a doc pointing at it: dropzone + caller fields + Cancel/submit. */
const UploadDocDialog = <T extends FieldValues>({
    doctype, fileField, isPrivate = true, accept, maxBytes, title, description,
    submitLabel, submitBusyLabel, defaults, mode, children, hint,
    onFilePicked, beforeUpload, docname, onCreated, trigger, open, onOpenChange,
}: UploadDocDialogProps<T>) => {
    const controlled = open !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = controlled ? open : internalOpen

    const form = useForm<T>({ defaultValues: defaults, mode })
    const [files, setFiles] = useState<File[]>([])
    const { upload, loading: uploading, error: uploadError, reset: resetUpload } = useFrappeFileUpload()
    const { createDoc, loading: creating, error: createError, reset: resetCreate } = useFrappeCreateDoc<T>()
    const busy = uploading || creating

    const resetState = () => {
        form.reset()
        setFiles([])
        resetUpload()
        resetCreate()
    }

    const setOpen = (next: boolean) => {
        if (!next) resetState()
        if (!controlled) setInternalOpen(next)
        onOpenChange?.(next)
    }

    const handleSetFiles: React.Dispatch<React.SetStateAction<File[]>> = (action) => {
        const next = typeof action === "function" ? action(files) : action
        const file = next[0]
        if (file && maxBytes && file.size > maxBytes) {
            toast.error(_("File size should not exceed {0}MB", [String(Math.round(maxBytes / (1024 * 1024)))]))
            setFiles([])
            onFilePicked?.(null, form)
            return
        }
        setFiles(next)
        onFilePicked?.(file ?? null, form)
    }

    const onSubmit = async (data: T) => {
        const file = files[0]
        if (!file) return
        try {
            if (beforeUpload && !(await beforeUpload(data, form))) return
            const res = await upload(file, {
                doctype,
                docname: docname ? docname(data) : `new-${doctype.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
                fieldname: fileField,
                isPrivate,
            })
            const doc = await createDoc(doctype, { ...data, [fileField]: res.file_url })
            await onCreated(doc)
            // Controlled owners close via onCreated; avoid a second onOpenChange(false).
            resetState()
            if (!controlled) setInternalOpen(false)
        } catch {
            // Surfaced by the upload/create error banners.
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {!controlled && (
                <DialogTrigger asChild>
                    {trigger ?? <Button type="button" size="sm">{title}</Button>}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        {uploadError && <ErrorBanner error={uploadError} />}
                        {createError && <ErrorBanner error={createError} />}
                        <FileDropzone files={files} setFiles={handleSetFiles} multiple={false} accept={accept} />
                        {(hint || accept || maxBytes) ? <div className="-mt-2 flex flex-col gap-0.5 text-p-sm text-ink-gray-5">
                            {hint && <p>{hint}</p>}
                            {accept && <p>{_("Supported formats: {0}", [Object.values(accept).flat().join(", ")])}</p>}
                            {maxBytes && <p>{_("Maximum file size: {0}MB", [String(Math.round(maxBytes / (1024 * 1024)))])}</p>}
                        </div> : null}
                        {children}
                        <DialogFooter className="flex-row justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)} disabled={busy}>
                                {_("Cancel")}
                            </Button>
                            <Button type="submit" size="md" disabled={busy || files.length === 0}>
                                {busy && <Spinner />}
                                {busy ? (submitBusyLabel ?? _("Saving...")) : (submitLabel ?? _("Upload"))}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default UploadDocDialog
