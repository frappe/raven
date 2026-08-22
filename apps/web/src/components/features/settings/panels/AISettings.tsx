import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { Separator } from "@components/ui/separator"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Button } from "@components/ui/button"
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
    const localProvider = useWatch({ control, name: "local_llm_provider" })
    const localLLMUrl = useWatch({ control, name: "local_llm_api_url" })

    const { data: openaiVersion } = useFrappeGetCall<{ message: string }>(
        "raven.api.ai_features.get_open_ai_version",
        undefined,
        openaiEnabled ? undefined : null
    )

    const { call: testConnection, loading: testing } = useFrappePostCall<{
        message: { success: boolean; message: string; models?: { id: string }[] }
    }>("raven.api.ai_features.test_llm_configuration")

    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleTestConnection = async () => {
        try {
            const result = await testConnection({
                provider: "Local LLM",
                api_url: localLLMUrl,
                local_llm_provider: localProvider,
            })
            setTestResult({ success: result.message.success, message: result.message.message })
            if (result.message.success) {
                toast.success(_("Connection successful!"))
            } else {
                toast.error(result.message.message)
            }
        } catch {
            toast.error(_("Failed to test connection"))
            setTestResult({ success: false, message: _("Failed to test connection") })
        }
    }

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
                                rules={{
                                    required: _("Please add your OpenAI Organization ID"),
                                    maxLength: { value: 140, message: _("ID cannot be more than 140 characters.") },
                                }}
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
                                rules={{ maxLength: { value: 140, message: _("ID cannot be more than 140 characters.") } }}
                                inputProps={{ placeholder: "proj_************************", autoComplete: "off" }}
                            />
                        </div>
                    ) : null}
                    {openaiEnabled ? (openaiVersion && (
                        <p className="text-sm text-ink-gray-5">{_("OpenAI Python SDK Version:")} {openaiVersion.message}</p>
                    )) : null}

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
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <DataField
                                        name="local_llm_api_url"
                                        label={_("API URL")}
                                        inputProps={{ placeholder: "http://localhost:11434/v1", autoComplete: "off" }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTestConnection}
                                    disabled={testing || !localLLMUrl}
                                >
                                    {_("Test Connection")}
                                </Button>
                            </div>
                            {localProvider === "OpenAI Compatible" ? (
                                <DataField
                                    name="openai_compatible_api_key"
                                    label={_("API Key")}
                                    formDescription={_("Optional — only if your provider requires it.")}
                                    inputProps={{ type: "password", placeholder: "••••••••••••••••••••", autoComplete: "off" }}
                                />
                            ) : null}
                            {testResult && (
                                <Alert theme={testResult.success ? "green" : "red"}>
                                    <AlertDescription>{testResult.message}</AlertDescription>
                                </Alert>
                            )}
                            <Alert theme="blue">
                                <AlertDescription>
                                    {localProvider === "LM Studio" && _("Make sure LM Studio is running with the server enabled on the specified URL.")}
                                    {localProvider === "Ollama" && _("Make sure Ollama is running. Default URL is usually http://localhost:11434/v1")}
                                    {localProvider === "LocalAI" && _("Make sure LocalAI is running on the specified URL.")}
                                    {localProvider === "OpenAI Compatible" && _("Make sure your OpenAI compatible service is running on the specified URL and that you have provided a valid API key.")}
                                    {!localProvider && _("Select a provider to see specific instructions.")}
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : null}
                </>
            ) : null}
        </>
    )
}

/** AI Settings — configure AI providers (OpenAI / local LLM); provider sections show only when AI integration is on. */
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
