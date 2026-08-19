import { useFormContext, useWatch } from "react-hook-form"
import { Separator } from "@components/ui/separator"
import { DataField, SelectFormField, SwitchFormField } from "@components/ui/form-elements"
import { SelectItem } from "@components/ui/select"
import { AdminSettingsForm } from "./AdminSettingsForm"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import _ from "@lib/translate"

const FORM_ID = "settings-ai-form"

/**
 * The fields, as their own component rather than a render prop — see AdminSettingsForm
 * for why. useWatch subscribes this component to the switches, so the provider sections
 * appear the moment one is toggled.
 */
const AISettingsFields = () => {
    const { control } = useFormContext<RavenSettings>()
    const aiEnabled = useWatch({ control, name: "enable_ai_integration" })
    const openaiEnabled = useWatch({ control, name: "enable_openai_services" })
    const localEnabled = useWatch({ control, name: "enable_local_llm" })

    return (
        <>
            <SwitchFormField
                name="enable_ai_integration"
                label={_("Enable AI Integration")}
                formDescription={_("Turn on AI features across Raven.")}
            />

            {aiEnabled ? (
                <>
                    <Separator />

                    {/* OpenAI */}
                    <SwitchFormField
                        name="enable_openai_services"
                        label={_("Enable OpenAI Services")}
                        formDescription={_("Use OpenAI models for AI features.")}
                    />
                    {openaiEnabled ? (
                        <div className="flex flex-col gap-4 pl-1">
                            <DataField
                                name="openai_organisation_id"
                                label={_("OpenAI Organization ID")}
                                isRequired
                                rules={{ required: _("Please add your OpenAI Organization ID") }}
                                inputProps={{ placeholder: "org-************************", autoComplete: "off" }}
                            />
                            <DataField
                                name="openai_api_key"
                                label={_("OpenAI API Key")}
                                isRequired
                                rules={{ required: _("Please add your OpenAI API Key") }}
                                inputProps={{ type: "password", placeholder: "••••••••••••••••••••", autoComplete: "off" }}
                            />
                            <DataField
                                name="openai_project_id"
                                label={_("OpenAI Project ID")}
                                formDescription={_("If not set, the integration uses the default project.")}
                                inputProps={{ placeholder: "proj_************************", autoComplete: "off" }}
                            />
                        </div>
                    ) : null}

                    <Separator />

                    {/* Local LLM */}
                    <SwitchFormField
                        name="enable_local_llm"
                        label={_("Enable Local LLM")}
                        formDescription={_("Use a self-hosted, OpenAI-compatible model.")}
                    />
                    {localEnabled ? (
                        <div className="flex flex-col gap-4 pl-1">
                            <SelectFormField name="local_llm_provider" label={_("Provider")}>
                                <SelectItem value="LM Studio">{_("LM Studio")}</SelectItem>
                                <SelectItem value="Ollama">{_("Ollama")}</SelectItem>
                                <SelectItem value="LocalAI">{_("LocalAI")}</SelectItem>
                                <SelectItem value="OpenAI Compatible">{_("OpenAI Compatible")}</SelectItem>
                            </SelectFormField>
                            <DataField
                                name="local_llm_api_url"
                                label={_("API URL")}
                                inputProps={{ placeholder: "http://localhost:11434/v1", autoComplete: "off" }}
                            />
                            <DataField
                                name="openai_compatible_api_key"
                                label={_("API Key")}
                                formDescription={_("Optional — only if your provider requires it.")}
                                inputProps={{ type: "password", placeholder: "••••••••••••••••••••", autoComplete: "off" }}
                            />
                        </div>
                    ) : null}
                </>
            ) : null}
        </>
    )
}

/**
 * AI Settings — configure AI providers (OpenAI / local LLM). Ported from v2's
 * AISettings; the provider sections show only when AI integration is on.
 */
export const AISettings = () => (
    <AdminSettingsForm
        title={_("AI Settings")}
        description={_("Configure AI providers to use AI features in Raven.")}
        formId={FORM_ID}
    >
        <AISettingsFields />
    </AdminSettingsForm>
)

export default AISettings
