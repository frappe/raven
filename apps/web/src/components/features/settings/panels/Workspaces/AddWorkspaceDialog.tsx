import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useFrappeCreateDoc, useFrappeFileUpload, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
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
import { DataField, SmallTextField, SwitchFormField } from "@components/ui/form-elements"
import { Label } from "@components/ui/label"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { FileDropzone } from "@components/ui/file-dropzone"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import { hasRole } from "@lib/permissions"
import type { RavenWorkspace } from "@raven/types/Raven/RavenWorkspace"
import _ from "@lib/translate"

/** Extends the generated type with the field that exists in the DocType but is not yet in the TS definition. */
type WorkspaceFormData = RavenWorkspace & {
    only_admins_can_create_channels?: 0 | 1
}

/** "Create" in the Workspaces panel header; jumps to the new workspace's detail view on success. */
const CreateWorkspaceButton = ({ onCreated }: { onCreated: (workspaceID: string) => void }) => {
    const [open, setOpen] = useState(false)
    const isRavenAdmin = hasRole("Raven Admin")

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={!isRavenAdmin}>
                    <PlusIcon />
                    {_("Create")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{_("Create Workspace")}</DialogTitle>
                    <DialogDescription>
                        {_("Workspaces allow you to organize your channels and teams.")}
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <AddWorkspaceForm
                        onClose={(workspaceID) => {
                            setOpen(false)
                            if (workspaceID) onCreated(workspaceID)
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

const AddWorkspaceForm = ({ onClose }: { onClose: (workspaceID?: string) => void }) => {
    const { mutate } = useSWRConfig()
    const form = useForm<WorkspaceFormData>({ defaultValues: { type: "Public" } })
    const [logoFiles, setLogoFiles] = useState<File[]>([])

    const { createDoc, loading: creatingDoc, error } = useFrappeCreateDoc<WorkspaceFormData>()
    const { updateDoc, loading: updatingDoc } = useFrappeUpdateDoc()
    const { upload, loading: uploadingFile, error: fileError } = useFrappeFileUpload()

    const loading = creatingDoc || uploadingFile || updatingDoc

    const onSubmit = (data: WorkspaceFormData) => {
        createDoc("Raven Workspace", data)
            .then((res) => {
                const logo = logoFiles[0]
                if (logo) {
                    return upload(logo, {
                        doctype: "Raven Workspace",
                        docname: res.name,
                        fieldname: "logo",
                        otherData: { optimize: "1" },
                        isPrivate: false,
                    })
                        .then((fileRes) => updateDoc("Raven Workspace", res.name, { logo: fileRes.file_url }))
                        .then(() => res)
                }
                return res
            })
            .then((res) => {
                mutate("workspaces_list")
                mutate("channel_list")
                toast.success(_("Workspace created"), {
                    description: _("You can now invite members to {0}", [res.workspace_name]),
                    duration: 2000,
                })
                onClose(res.name)
            })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {error && <ErrorBanner error={error} />}
                {fileError && <ErrorBanner error={fileError} />}
                <DataField
                    name="workspace_name"
                    label={_("Workspace Name")}
                    isRequired
                    rules={{ required: _("Name is required") }}
                    inputProps={{ autoFocus: true, placeholder: _("e.g. My Workspace") }}
                />
                <SmallTextField
                    name="description"
                    label={_("Description")}
                    inputProps={{ rows: 2, placeholder: _("What is this workspace for?") }}
                />
                <div className="flex flex-col gap-2">
                    <Label>{_("Workspace Type")}</Label>
                    <Controller
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                                <label className="flex items-center gap-2 text-p-base text-ink-gray-8">
                                    <RadioGroupItem value="Public" /> {_("Public")}
                                </label>
                                <label className="flex items-center gap-2 text-p-base text-ink-gray-8">
                                    <RadioGroupItem value="Private" /> {_("Private")}
                                </label>
                            </RadioGroup>
                        )}
                    />
                    <p className="text-p-sm text-ink-gray-5">
                        {_("Private workspaces can only be viewed or joined by invitation. Public workspaces are open to everyone.")}
                    </p>
                </div>
                <SwitchFormField
                    name="only_admins_can_create_channels"
                    label={_("Only admins can create channels")}
                />
                <div className="flex flex-col gap-2">
                    <Label>{_("Workspace Logo")}</Label>
                    <FileDropzone
                        files={logoFiles}
                        setFiles={setLogoFiles}
                        multiple={false}
                        accept={{ "image/*": [".jpeg", ".jpg", ".png", ".svg", ".webp"] }}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button size="md" type="button" variant="outline" disabled={loading}>{_("Cancel")}</Button>
                    </DialogClose>
                    <Button size="md" type="submit" disabled={loading}>
                        {loading && <Spinner />}
                        {loading ? _("Saving") : _("Save")}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default CreateWorkspaceButton
