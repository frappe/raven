import { Controller, useFormContext } from "react-hook-form"
import { Label } from "@components/ui/label"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { SmallTextField, SwitchFormField } from "@components/ui/form-elements"
import _ from "@lib/translate"
import WorkspaceLogoField from "./WorkspaceLogoField"
import type { WorkspaceFormData } from "./WorkspaceDetailView"

/** Details tab — logo, description, type, channel-creation policy. Parent owns submit. */
const WorkspaceEditForm = ({ disabled = false }: { disabled?: boolean }) => {
    const { control } = useFormContext<WorkspaceFormData>()

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="flex items-center justify-center rounded-lg bg-surface-gray-1 dark:bg-surface-gray-2 py-6">
                <WorkspaceLogoField disabled={disabled} />
            </div>
            <SmallTextField
                name="description"
                label={_("Description")}
                inputProps={{ rows: 2, placeholder: _("What is this workspace for?") }}
            />
            <div className="flex flex-col gap-2">
                <Label>{_("Workspace Type")}</Label>
                <Controller
                    control={control}
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
        </div>
    )
}

export default WorkspaceEditForm
