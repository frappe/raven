import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@components/ui/dialog"
import { Form } from "@components/ui/form"
import { DataField } from "@components/ui/form-elements"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { FileDropzone } from "@components/ui/file-dropzone"
import { useForm } from "react-hook-form"
import { FrappeConfig, FrappeContext, useFrappeCreateDoc, useFrappeFileUpload } from "frappe-react-sdk"
import { Loader2 } from "lucide-react"
import { useContext, useState } from "react"
import _ from "@lib/translate"

interface AddEmojiFormData {
    emoji_name: string
    keywords: string
}

/** Emoji names allow only lowercase letters, numbers and underscores. */
const toEmojiName = (fileName: string) =>
    fileName
        .split(".")
        .slice(0, -1)
        .join(".")
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20)

interface AddCustomEmojiDialogProps {
    open: boolean
    onClose: (refresh?: boolean) => void
}

/**
 * Dialog for adding a new custom emoji.
 * Currently supports emoji name and keywords.
 * TODO: File upload and wire up to file upload component in createDoc.
 */
const AddCustomEmojiDialog = ({ open, onClose }: AddCustomEmojiDialogProps) => {
    const form = useForm<AddEmojiFormData>({
        defaultValues: {
            emoji_name: "",
            keywords: "",
        },
        mode: "onBlur",
    })

    const { call } = useContext(FrappeContext) as FrappeConfig
    const { createDoc, loading, error, reset: resetError } = useFrappeCreateDoc()
    const { upload, loading: uploading, error: uploadError, reset: resetUpload } = useFrappeFileUpload()

    const [files, setFiles] = useState<File[]>([])

    const onSubmit = async (data: AddEmojiFormData) => {
        const image = files[0]
        if (!image) return
        try {
            const exists = await checkIfEmojiNameExists(data.emoji_name)
            if (exists) {
                form.setError('emoji_name', { message: _("Emoji {0} already exists.", [data.emoji_name]) })
                return
            }

            // Upload the image first, then create the emoji pointing at its URL.
            const fileRes = await upload(image, {
                doctype: "Raven Custom Emoji",
                docname: data.emoji_name,
                fieldname: "image",
                isPrivate: false,
            })
            await createDoc("Raven Custom Emoji", {
                emoji_name: data.emoji_name,
                keywords: data.keywords,
                image: fileRes.file_url,
            })
            form.reset()
            setFiles([])
            // close the dialog and refresh the emoji list
            onClose(true)
        } catch {
            // Errors are surfaced by useFrappeCreateDoc / useFrappeFileUpload
        }
    }

    // Seed the emoji name from the dropped file's name (first drop only).
    const onDropImage = (accepted: File[]) => {
        if (accepted[0] && !form.getValues("emoji_name")) {
            form.setValue("emoji_name", toEmojiName(accepted[0].name), { shouldValidate: true })
        }
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            form.reset()
            setFiles([])
            resetError()
            resetUpload()
            onClose(false)
        }
    }

    const checkIfEmojiNameExists = async (name: string) => {
        const emoji = await call.get('frappe.client.get_count', {
            doctype: 'Raven Custom Emoji',
            filters: {
                emoji_name: name
            }
        })
        return emoji?.message > 0
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{_("Add Emoji")}</DialogTitle>
                    <DialogDescription>
                        {_("Add a custom emoji to use in your chats and reactions.")}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex flex-col gap-4"
                    >
                        {error && <ErrorBanner error={error} />}
                        {uploadError && <ErrorBanner error={uploadError} />}

                        <FileDropzone
                            files={files}
                            setFiles={setFiles}
                            multiple={false}
                            accept={{ "image/*": [".jpeg", ".jpg", ".png", ".svg", ".gif", ".webp"] }}
                            onDrop={onDropImage}
                        />
                        <p className="text-p-sm text-ink-gray-5 -mt-2">
                            {_("128px × 128px PNG, SVG or GIF recommended.")}
                        </p>

                        <DataField
                            name="emoji_name"
                            label={_("Emoji Name")}
                            isRequired
                            rules={{
                                required: _("Name is required"),
                                maxLength: {
                                    value: 20,
                                    message: _("Name must be less than 20 characters"),
                                },
                                pattern: {
                                    value: /^[a-z0-9_]+$/,
                                    message: _("Only lowercase letters, numbers, and underscores allowed"),
                                },
                            }}
                            inputProps={{
                                placeholder: _("e.g. party_parrot"),
                                autoComplete: "off",
                            }}
                        />

                        <DataField
                            name="keywords"
                            label={_("Keywords")}
                            formDescription={_("You will be able to search for this emoji by these keywords.(Optional)")}
                            inputProps={{
                                placeholder: _("e.g. party, celebrate, dance"),
                                autoComplete: "off",
                            }}
                        />

                        <DialogFooter className="pt-4">
                            <Button size="md"
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={loading || uploading}
                            >
                                {_("Cancel")}
                            </Button>
                            <Button size="md" type="submit" disabled={loading || uploading || files.length === 0}>
                                {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading || uploading ? _("Saving...") : _("Save")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default AddCustomEmojiDialog
