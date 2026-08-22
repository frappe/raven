import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useFrappeCreateDoc, useFrappeFileUpload } from "frappe-react-sdk"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@components/ui/dialog"
import { Form } from "@components/ui/form"
import { DataField } from "@components/ui/form-elements"
import ErrorBanner from "@components/ui/error-banner"
import { FileDropzone } from "@components/ui/file-dropzone"
import { Spinner } from "@components/ui/spinner"
import type { RavenAIFileSource } from "@raven/types/RavenAI/RavenAIFileSource"
import _ from "@lib/translate"

const MAX_FILE_SIZE = 10 * 1024 * 1024

type FileSourceUploadDialogProps = {
    /** Called with the new doc name once upload + create succeed. */
    onUpload: (id: string) => void | Promise<void>
    /** Custom dialog trigger. Defaults to a primary "Upload" button. */
    trigger?: React.ReactNode
}

/**
 * Upload a file and create a Raven AI File Source for AI Agents to use.
 * Also reused by the Agents panel to attach files to an agent.
 */
export const FileSourceUploadDialog = ({ onUpload, trigger }: FileSourceUploadDialogProps) => {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button type="button" size="sm">
                        {_("Upload")}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{_("Upload File")}</DialogTitle>
                    <DialogDescription>
                        {_("Upload a file to use as a data source for AI Agents.")}
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <FileSourceUploadForm
                        onUpload={(id) => {
                            onUpload(id)
                            setOpen(false)
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

const FileSourceUploadForm = ({ onUpload }: { onUpload: (id: string) => void | Promise<void> }) => {
    const form = useForm<RavenAIFileSource>()
    const [files, setFiles] = useState<File[]>([])

    const { upload, loading: uploadLoading, error: uploadError } = useFrappeFileUpload()
    const { createDoc, loading: createLoading, error: createError } = useFrappeCreateDoc<RavenAIFileSource>()

    const file = files[0]
    const loading = uploadLoading || createLoading

    const onFileDrop = (acceptedFiles: File[]) => {
        const picked = acceptedFiles[0]
        if (!picked) return
        // FileDropzone sets state before calling us — evict oversized picks ourselves.
        if (picked.size > MAX_FILE_SIZE) {
            toast.error(_("File size should not exceed 10MB"))
            setFiles([])
            form.setValue("file_name", "")
            return
        }
        setFiles([picked])
        form.setValue("file_name", picked.name.split(".")[0], { shouldValidate: true })
    }

    // Keep file_name in sync when a file is removed via the dropzone's trash button.
    const handleSetFiles = (value: React.SetStateAction<File[]>) => {
        const next = typeof value === "function" ? value(files) : value
        setFiles(next)
        if (next.length === 0) {
            form.setValue("file_name", "")
        }
    }

    const onSubmit = (data: RavenAIFileSource) => {
        if (!file) return
        upload(file, {
            doctype: "Raven AI File Source",
            docname: "new-raven-ai-file-source-" + Date.now(),
            fieldname: "file",
            isPrivate: true,
        })
            .then((res) =>
                createDoc("Raven AI File Source", {
                    ...data,
                    file: res.file_url,
                })
            )
            .then((doc) => onUpload(doc.name))
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {uploadError && <ErrorBanner error={uploadError} />}
                {createError && <ErrorBanner error={createError} />}

                <FileDropzone
                    files={files}
                    setFiles={handleSetFiles}
                    multiple={false}
                    onDrop={onFileDrop}
                />

                <DataField
                    name="file_name"
                    label={_("File Name")}
                    isRequired
                    rules={{ required: _("File name is required") }}
                    inputProps={{ autoComplete: "off" }}
                />

                <DialogFooter className="flex-row justify-end gap-2">
                    <DialogClose asChild>
                        <Button type="button" size="md" variant="outline" disabled={loading}>
                            {_("Cancel")}
                        </Button>
                    </DialogClose>
                    <Button type="submit" size="md" disabled={loading || !file}>
                        {loading && <Spinner />}
                        {loading ? _("Uploading...") : _("Upload")}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default FileSourceUploadDialog
