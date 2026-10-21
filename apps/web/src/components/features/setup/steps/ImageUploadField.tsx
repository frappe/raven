import { useRef } from "react"
import { useFormContext } from "react-hook-form"
import { useFrappeFileUpload } from "frappe-react-sdk"
import { ImageIcon, Upload } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { FormControl, FormField, FormItem, FormLabel } from "@components/ui/form"
import _ from "@lib/translate"
import { cn } from "@lib/utils"

type ImageUploadFieldProps = {
    /** The form field holding the uploaded file's URL. */
    name: string
    label: string
    /** Where the file attaches; `docname` is empty for a record not saved yet. */
    attachTo: { doctype: string; docname: string; fieldname: string }
    shape?: "square" | "round"
    /** Hears an upload start and end, so the form can hold its save until the URL is in. */
    onUploadingChange?: (uploading: boolean) => void
}

/** An image tile with Upload, then Reupload and Remove. Picking a file uploads it straight away. */
export const ImageUploadField = ({ name, label, attachTo, shape = "square", onUploadingChange }: ImageUploadFieldProps) => {
    const { control } = useFormContext()
    const { upload, loading, error, reset } = useFrappeFileUpload()
    const input = useRef<HTMLInputElement>(null)
    const rounding = shape === "round" ? "rounded-full" : "rounded"

    return (
        <FormField
            control={control}
            name={name}
            render={({ field: { value, onChange } }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>{label}</FormLabel>
                    <div className="flex items-center gap-2">
                        <Avatar className={cn("size-8", rounding)}>
                            {value && <AvatarImage src={value} alt="" className="object-cover" />}
                            <AvatarFallback className={cn("bg-surface-gray-2 text-ink-gray-5", rounding)}>
                                <ImageIcon className="size-4" />
                            </AvatarFallback>
                        </Avatar>
                        <FormControl>
                            <Button type="button" variant="subtle" size="sm" loading={loading} onClick={() => input.current?.click()}>
                                {!loading && <Upload />}
                                {value ? _("Reupload") : _("Upload image")}
                            </Button>
                        </FormControl>
                        {value && !loading && (
                            <Button type="button" variant="ghost" size="sm" className="text-ink-gray-5" onClick={() => onChange("")}>
                                {_("Remove")}
                            </Button>
                        )}
                        <input
                            ref={input}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                // Cleared, so picking the same file again still uploads it.
                                event.target.value = ""
                                if (!file) return
                                reset()
                                onUploadingChange?.(true)
                                upload(file, { ...attachTo, otherData: { optimize: "1" }, isPrivate: false })
                                    .then((uploaded) => onChange(uploaded.file_url))
                                    .catch(() => { })
                                    .finally(() => onUploadingChange?.(false))
                            }}
                        />
                    </div>
                    {error && <ErrorBanner error={error} />}
                </FormItem>
            )}
        />
    )
}
