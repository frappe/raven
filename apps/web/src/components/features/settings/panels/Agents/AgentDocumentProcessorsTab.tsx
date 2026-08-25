import { Controller, useFormContext, useFormState, useWatch } from "react-hook-form"
import { useFrappeGetCall } from "frappe-react-sdk"
import { useSetAtom } from "jotai"
import { CheckIcon, InfoIcon } from "lucide-react"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Badge } from "@components/ui/badge"
import { FormMessage } from "@components/ui/form"
import { SwitchFormField } from "@components/ui/form-elements"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { Separator } from "@components/ui/separator"
import { Skeleton } from "@components/ui/skeleton"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import type { ExistingProcessor } from "../DocumentProcessors/DocumentProcessors"
import _ from "@lib/translate"
import { isProcessorActive } from "../ai/processorState"

interface ExistingProcessorsResponse {
    message: ExistingProcessor[]
}

const getProcessorTypeBestFor = (processorType: string) => {
    switch (processorType) {
        case "OCR_PROCESSOR":
            return ["General text extraction", "Multi-language documents", "Handwriting recognition"]
        case "FORM_PARSER_PROCESSOR":
            return ["Application forms", "Surveys", "Registration forms", "Structured data"]
        case "BANK_STATEMENT_PROCESSOR":
            return ["Financial analysis", "Loan processing", "Bank statement digitization"]
        case "INVOICE_PROCESSOR":
            return ["Invoice processing", "Accounts payable automation", "Tax document preparation", "Financial record keeping"]
        case "EXPENSE_PROCESSOR":
            return ["Expense reports", "Travel reimbursements", "Receipt digitization"]
        default:
            return []
    }
}

/** Document Processors tab of the Raven Bot editor. */
const AgentDocumentProcessorsTab = () => {
    const { control } = useFormContext<RavenBot>()
    const formState = useFormState({ control, name: "google_document_processor_id" })
    const { ravenSettings } = useRavenSettings()
    const setOpenTab = useSetAtom(settingsDialogOpenTab)

    const useDocumentParser = useWatch({ control, name: "use_google_document_parser" })
    const isGoogleApisEnabled = ravenSettings?.enable_google_apis

    const {
        data: existingProcessors,
        isLoading: loadingProcessors,
        error: processorsError,
    } = useFrappeGetCall<ExistingProcessorsResponse>(
        "raven.ai.google_ai.get_list_of_processors",
        undefined,
        useDocumentParser && isGoogleApisEnabled ? undefined : null,
        { revalidateOnFocus: false },
    )

    if (!isGoogleApisEnabled) {
        return (
            <Alert theme="red">
                <InfoIcon />
                <AlertDescription>
                    {_("Document Processors require Google Cloud APIs to be enabled in your Raven settings.")}
                </AlertDescription>
            </Alert>
        )
    }

    const hasExistingProcessors = existingProcessors?.message && existingProcessors.message.length > 0

    return (
        <div className="flex flex-col gap-4">
            <SwitchFormField
                name="use_google_document_parser"
                label={_("Use Google Document/Vision AI to parse documents")}
                formDescription={_(
                    "When images or PDFs are uploaded to the agent, Raven will automatically call Google Cloud APIs to process the document and send its results to the agent for better context."
                )}
            />

            {useDocumentParser ? (
                <>
                    <Separator />
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h5 className="text-sm font-semibold">{_("Document Processor Selection")}</h5>
                            <div className="flex flex-wrap items-center gap-1">
                                <p className="text-p-sm text-ink-gray-6">
                                    {_("Choose an existing document processor for this bot. Processors can be shared across multiple bots.")}
                                </p>
                                <button
                                    type="button"
                                    className="font-medium underline underline-offset-2"
                                    onClick={() => setOpenTab("document-processors")}
                                >
                                    {_("Create Document Processors")}
                                </button>
                            </div>
                        </div>

                        {/* Loading state */}
                        {loadingProcessors && <Skeleton className="h-10 w-full" />}

                        {/* Error state */}
                        {processorsError && (
                            <Alert theme="red">
                                <InfoIcon />
                                <AlertDescription>
                                    {_("Error fetching processors: {0}", [processorsError.message])}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* No processors available */}
                        {!loadingProcessors && !processorsError && !hasExistingProcessors && (
                            <Alert theme="amber">
                                <InfoIcon />
                                <AlertDescription className="flex flex-wrap items-center gap-1">
                                    <span>
                                        {_(
                                            "No document processors have been created yet. You need to create at least one processor before you can assign it to this bot."
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="font-medium underline underline-offset-2"
                                        onClick={() => setOpenTab("document-processors")}
                                    >
                                        {_("Create Document Processors")}
                                    </button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Processor selection */}
                        {!loadingProcessors && hasExistingProcessors && (
                            <div className="flex flex-col gap-3">
                                <Controller
                                    control={control}
                                    name="google_document_processor_id"
                                    render={({ field }) => (
                                        <RadioGroup
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            className="flex flex-col gap-3"
                                        >
                                            {existingProcessors.message.map((processor) => (
                                                <label
                                                    key={processor.id}
                                                    className="flex cursor-pointer items-start gap-3 rounded-md border border-outline-gray-2 p-3 transition-colors hover:bg-surface-gray-1 md:p-2"
                                                >
                                                    <RadioGroupItem value={processor.id} className="mt-0.5" />
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-medium text-ink-gray-8 md:text-sm">
                                                                {processor.display_name}
                                                            </span>
                                                            <Badge variant="subtle" theme={isProcessorActive(processor.state) ? "green" : "red"}>
                                                                {isProcessorActive(processor.state) ? _("Active") : _("Inactive")}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-base text-ink-gray-6 md:text-sm">{processor.type}</span>
                                                        <div className="flex flex-col gap-1">
                                                            {getProcessorTypeBestFor(processor.type).map((bestFor, index) => (
                                                                <span
                                                                    key={index}
                                                                    className="flex items-center gap-2 text-p-sm text-ink-gray-6"
                                                                >
                                                                    <CheckIcon className="size-4 shrink-0" />
                                                                    {bestFor}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </RadioGroup>
                                    )}
                                />

                                <p className="text-p-sm text-ink-gray-6">
                                    {_(
                                        "This processor will be used to process any documents, images, or PDFs uploaded to the thread and send its results to the agent for better context."
                                    )}
                                </p>

                                {formState.errors.google_document_processor_id && (
                                    <FormMessage>
                                        {formState.errors.google_document_processor_id.message}
                                    </FormMessage>
                                )}
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    )
}

export default AgentDocumentProcessorsTab
