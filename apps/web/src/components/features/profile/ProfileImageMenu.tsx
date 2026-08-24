import { useRef, useState } from "react"
import { useFrappePostCall, useFrappeFileUpload, FrappeError } from "frappe-react-sdk"
import { toast } from "sonner"
import { ImagePlus, Trash2 } from "lucide-react"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Spinner } from "@components/ui/spinner"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"

/**
 * The profile page's avatar — tapping it opens an Upload / Remove photo menu. Photo changes
 * commit immediately (no Save step), unlike the details form in EditProfileDrawer.
 */
export function ProfileImageMenu() {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")
    const { upload } = useFrappeFileUpload()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)

    // Single commit path for set + remove: a full doc save, so doc events fire
    // (cache invalidation etc.) — which a db-level write from the upload wouldn't.
    const setImage = (fileURL: string) => {
        if (!myProfile?.name) return Promise.resolve()
        return call({ doctype: "Raven User", name: myProfile.name, fieldname: "user_image", value: fileURL }).then(() => mutate())
    }

    const onPickImage = async (file: File | undefined) => {
        if (!file || !myProfile?.name) return
        setSaving(true)
        try {
            // No `fieldname` on the upload — that would write user_image directly via
            // db.set_value, skipping doc events. Attach the file, then commit via setImage.
            const res = await upload(file, {
                // A profile photo must be PUBLIC (rendered in avatars for everyone).
                // The SDK only appends is_private when `isPrivate` is truthy, so
                // isPrivate:false sends nothing and leans on the server default —
                // force is_private=0 explicitly via otherData so it's always public.
                isPrivate: false,
                doctype: "Raven User",
                docname: myProfile.name,
                otherData: { optimize: "1", is_private: "0" },
            })
            await setImage(res.file_url)
            toast.success(_("Photo updated"))
        } catch (e) {
            errorResponseToast(_("Could not update photo"), e as FrappeError)
        } finally {
            setSaving(false)
        }
    }

    const onRemoveImage = async () => {
        setSaving(true)
        try {
            await setImage("")
            toast.success(_("Photo removed"))
        } catch (e) {
            errorResponseToast(_("Could not remove photo"), e as FrappeError)
        } finally {
            setSaving(false)
        }
    }

    if (!myProfile) return null

    return (
        <>
            {myProfile.user_image ?
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={_("Change photo")}
                            className="relative rounded-full outline-none focus-visible:outline-none active:opacity-90"
                        >
                            <UserAvatar user={myProfile} size="2xl" className={cn("rounded-full", saving && "opacity-50")} showStatusIndicator />
                            {saving && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <Spinner className="text-ink-gray-9" />
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-44">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                            <ImagePlus />
                            {_("Upload a photo")}
                        </DropdownMenuItem>
                        {myProfile.user_image && (
                            <DropdownMenuItem variant="destructive" onClick={onRemoveImage}>
                                <Trash2 />
                                {_("Remove photo")}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                : <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={_("Upload photo")}
                    className="relative rounded-full outline-none focus-visible:outline-none active:opacity-90"
                >
                    <UserAvatar user={myProfile} size="2xl" className={cn("rounded-full", saving && "opacity-50")} showStatusIndicator />
                    {saving && (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <Spinner className="text-ink-gray-9" />
                        </span>
                    )}
                </button>}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = "" }}
            />
        </>
    )
}
