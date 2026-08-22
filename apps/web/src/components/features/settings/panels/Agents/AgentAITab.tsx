import { Controller, useFormContext, useWatch } from "react-hook-form"
import { InfoIcon } from "lucide-react"
import { Alert, AlertDescription } from "@components/ui/alert"
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@components/ui/form"
import { DataField, SwitchFormField } from "@components/ui/form-elements"
import { Separator } from "@components/ui/separator"
import { Slider } from "@components/ui/slider"
import { Switch } from "@components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import { ModelProviderSelector, ModelSelector, ReasoningEffortSelector } from "./AgentModelFields"
import _ from "@lib/translate"

/** AI tab of the Raven Bot editor. */
const AgentAITab = () => {
    const { control } = useFormContext<RavenBot>()
    const { ravenSettings } = useRavenSettings()
    const openAIAssistantID = useWatch({ control, name: "openai_assistant_id" })
    const modelProvider = useWatch({ control, name: "model_provider" })
    const isAiBot = useWatch({ control, name: "is_ai_bot" })

    const isLocalLLM = modelProvider === "Local LLM"
    const isOpenAI = !modelProvider || modelProvider === "OpenAI"

    const hasOpenAI = ravenSettings?.enable_openai_services === 1
    const hasLocalLLM = ravenSettings?.enable_local_llm === 1

    return (
        <div className="flex flex-col gap-4">
            {!isLocalLLM && openAIAssistantID && (
                <DataField
                    name="openai_assistant_id"
                    label={_("OpenAI Assistant ID")}
                    readOnly
                    inputProps={{ placeholder: "asst_*******************" }}
                />
            )}

            {isAiBot && !hasOpenAI && !hasLocalLLM ? (
                <Alert theme="red">
                    <AlertDescription>
                        {_("No AI providers are configured. Please configure OpenAI or Local LLM in AI Settings.")}
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    <ModelProviderSelector />
                    <ModelSelector />
                </div>
            )}

            {isOpenAI && <ReasoningEffortSelector />}

            <Separator />

            <SwitchFormField
                name="allow_bot_to_write_documents"
                label={_("Allow Agent to Write Documents")}
                formDescription={_("Checking this will allow the bot to create/update/delete documents in the system.")}
            />

            <Separator />

            {isOpenAI && (
                <>
                    <div className="grid gap-4 md:grid-cols-2">
                        <DocLinkedSwitchFormField
                            name="enable_file_search"
                            label={_("Enable File Search")}
                            docUrl="https://platform.openai.com/docs/assistants/tools/file-search"
                            docTitle={_("View OpenAI documentation about File Search")}
                            formDescription={_(
                                "Enable this if you want the bot to be able to read PDF files and scan them.\n\nFile search enables the assistant with knowledge from files that you upload.\nOnce a file is uploaded, the assistant automatically decides when to retrieve content based on user requests."
                            )}
                        />
                        <DocLinkedSwitchFormField
                            name="enable_code_interpreter"
                            label={_("Enable Code Interpreter")}
                            docUrl="https://platform.openai.com/docs/assistants/tools/code-interpreter"
                            docTitle={_("View OpenAI documentation about Code Interpreter")}
                            formDescription={_(
                                "Enable this if you want the bot to be able to process files like Excel sheets or data from Insights.\n\nOpenAI Assistants run code in a sandboxed environment (on OpenAI servers) to do this."
                            )}
                        />
                    </div>
                    <Separator />
                </>
            )}

            {isLocalLLM && (
                <Alert theme="blue">
                    <AlertDescription>
                        {_("Currently, code interpreter features are not available for Local LLM providers. These features require OpenAI's infrastructure.")}
                    </AlertDescription>
                </Alert>
            )}

            <h5 className="text-sm font-semibold">{_("Advanced")}</h5>

            <SwitchFormField
                name="debug_mode"
                label={_("Enable Debug Mode")}
                formDescription={_(
                    "If enabled, stack traces of errors will be sent as messages by the bot during runs.\nThis is helpful when you're testing your bots and want to know where things are going wrong."
                )}
            />

            <div className="grid gap-4 md:grid-cols-2">
                <NumberSliderField
                    name="temperature"
                    label={_("Temperature")}
                    min={0}
                    max={2}
                    formDescription={_(
                        "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic."
                    )}
                />
                <NumberSliderField
                    name="top_p"
                    label={_("Top P")}
                    min={0}
                    max={1}
                    formDescription={_(
                        "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or temperature but not both."
                    )}
                />
            </div>
        </div>
    )
}

type DocLinkedSwitchFormFieldProps = {
    name: "enable_file_search" | "enable_code_interpreter"
    label: string
    formDescription: string
    docUrl: string
    docTitle: string
}

/** SwitchFormField variant whose label carries an external-docs info link. */
const DocLinkedSwitchFormField = ({ name, label, formDescription, docUrl, docTitle }: DocLinkedSwitchFormFieldProps) => {
    const { control } = useFormContext<RavenBot>()

    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-1">
                            {label}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a
                                        href={docUrl}
                                        title={docTitle}
                                        aria-label={docTitle}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-ink-gray-4 hover:text-ink-gray-7"
                                    >
                                        <InfoIcon size={16} />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent>{docTitle}</TooltipContent>
                            </Tooltip>
                        </FormLabel>
                        <FormDescription>{formDescription}</FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            size="md"
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                        />
                    </FormControl>
                </FormItem>
            )}
        />
    )
}

type NumberSliderFieldProps = {
    name: "temperature" | "top_p"
    label: string
    min: number
    max: number
    formDescription: string
}

/** Controller-wrapped Slider with a label row, live mono readout and helper text. */
const NumberSliderField = ({ name, label, min, max, formDescription }: NumberSliderFieldProps) => {
    const { control } = useFormContext<RavenBot>()

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-p-sm-medium text-ink-gray-7">
                            {label}{" "}
                            <span className="font-normal text-ink-gray-5">{_("(Default: 1)")}</span>
                        </span>
                        <code className="font-mono text-p-xs tabular-nums text-ink-gray-5">
                            {(field.value ?? 1).toFixed(2)}
                        </code>
                    </div>
                    <Slider
                        value={[field.value ?? 1]}
                        onValueChange={(values) => field.onChange(values[0])}
                        min={min}
                        max={max}
                        step={0.01}
                        aria-label={label}
                    />
                    <p className="text-p-sm text-ink-gray-6">{formDescription}</p>
                </div>
            )}
        />
    )
}

export default AgentAITab
