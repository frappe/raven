import { useContext } from "react"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { DataField } from "@components/ui/form-elements"
import UploadDocDialog from "@components/common/UploadDocDialog"
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

/** Dialog for adding a new custom emoji. */
const AddCustomEmojiDialog = ({ open, onClose }: AddCustomEmojiDialogProps) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    const emojiNameExists = async (name: string) => {
        const emoji = await call.get("frappe.client.get_count", {
            doctype: "Raven Custom Emoji",
            filters: { emoji_name: name },
        })
        return emoji?.message > 0
    }

    return (
        <UploadDocDialog<AddEmojiFormData>
            doctype="Raven Custom Emoji"
            fileField="image"
            isPrivate={false}
            accept={{ "image/*": [".jpeg", ".jpg", ".png", ".svg", ".gif", ".webp"] }}
            title={_("Add Emoji")}
            description={_("Add a custom emoji to use in your chats and reactions.")}
            submitLabel={_("Save")}
            submitBusyLabel={_("Saving...")}
            defaults={{ emoji_name: "", keywords: "" }}
            mode="onBlur"
            hint={_("128px × 128px PNG, SVG or GIF recommended.")}
            docname={(data) => data.emoji_name}
            onFilePicked={(file, form) => {
                // Seed the emoji name from the dropped file's name (first pick only).
                if (file && !form.getValues("emoji_name")) {
                    form.setValue("emoji_name", toEmojiName(file.name), { shouldValidate: true })
                }
            }}
            beforeUpload={async (data, form) => {
                if (await emojiNameExists(data.emoji_name)) {
                    form.setError("emoji_name", { message: _("Emoji {0} already exists.", [data.emoji_name]) })
                    return false
                }
                return true
            }}
            onCreated={() => onClose(true)}
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose(false)
            }}
        >
            <DataField
                name="emoji_name"
                label={_("Emoji Name")}
                isRequired
                rules={{
                    required: _("Name is required"),
                    maxLength: { value: 20, message: _("Name must be less than 20 characters") },
                    pattern: { value: /^[a-z0-9_]+$/, message: _("Only lowercase letters, numbers, and underscores allowed") },
                }}
                inputProps={{ placeholder: _("e.g. party_parrot"), autoComplete: "off" }}
            />
            <DataField
                name="keywords"
                label={_("Keywords")}
                formDescription={_("You will be able to search for this emoji by these keywords.(Optional)")}
                inputProps={{ placeholder: _("e.g. party, celebrate, dance"), autoComplete: "off" }}
            />
        </UploadDocDialog>
    )
}

export default AddCustomEmojiDialog
