import { useFormContext, useFormState } from "react-hook-form"
import { LinkFormField, SwitchFormField } from "@components/ui/form-elements"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { useIsMobile } from "@hooks/use-mobile"
import type { RavenBotAIPrompt } from "@raven/types/RavenAI/RavenBotAIPrompt"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

/** Form fields for a saved command — rendered inside the editor's FormProvider. */
const SavedPromptForm = ({ isEdit }: { isEdit?: boolean }) => {
    const { register, control } = useFormContext<RavenBotAIPrompt>()
    const { errors } = useFormState({ control, name: "prompt" })
    const isMobile = useIsMobile()

    return (
        <div className="flex flex-col gap-4">
            <AINotEnabledCallout />
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="prompt">
                    {_("Prompt")}
                    <span className="text-ink-red-6" aria-hidden="true">*</span>
                </Label>
                <Textarea
                    id="prompt"
                    {...register("prompt", { required: _("Prompt is required") })}
                    rows={5}
                    autoFocus={!isEdit && !isMobile}
                    placeholder={_("Can you create purchase invoices from these files?")}
                    aria-invalid={errors.prompt ? "true" : "false"}
                />
                {errors.prompt && <p className="text-sm text-ink-red-9">{String(errors.prompt.message)}</p>}
            </div>
            <SwitchFormField
                name="is_global"
                label={_("Is Global")}
                formDescription={_("If checked, this prompt will be available to all users on Raven")}
            />
            <LinkFormField
                name="raven_bot"
                label={_("Agent")}
                doctype="Raven Bot"
                filters={[["is_ai_bot", "=", 1]]}
                formDescription={_("If added, this prompt will only be shown when interacting with the agent")}
            />
        </div>
    )
}

export default SavedPromptForm
