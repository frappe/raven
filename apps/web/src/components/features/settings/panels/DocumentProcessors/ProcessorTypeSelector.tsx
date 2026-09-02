import { useFrappeGetCall } from "frappe-react-sdk"
import { CheckIcon, CircleAlertIcon } from "lucide-react"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Badge } from "@components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { Skeleton } from "@components/ui/skeleton"
import type { ProcessorTypeConfig } from "./DocumentProcessors"
import _ from "@lib/translate"

/** Radio-card picker for the Google processor type to create. */
const ProcessorTypeSelector = ({
    selectedProcessorType,
    setSelectedProcessorType,
}: {
    selectedProcessorType: string
    setSelectedProcessorType: (processorType: string) => void
}) => {
    const { data: processorTypes, isLoading: loadingTypes, error: typesError } = useFrappeGetCall<{
        message: Record<string, ProcessorTypeConfig>
    }>("raven.ai.google_ai.get_available_processor_types", undefined, undefined, { revalidateOnFocus: false })

    if (loadingTypes) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )
    }

    if (typesError) {
        return (
            <Alert theme="red">
                <CircleAlertIcon />
                <AlertDescription>{_("Error loading processor types: {0}", [typesError.message])}</AlertDescription>
            </Alert>
        )
    }

    if (!processorTypes?.message) return null

    return (
        <div className="flex flex-col gap-3">
            <h5 className="text-base font-medium">{_("Create a new processor")}</h5>
            <RadioGroup
                value={selectedProcessorType}
                onValueChange={setSelectedProcessorType}
                className="flex flex-col gap-3"
            >
                {Object.entries(processorTypes.message).map(([key, config]) => (
                    <label
                        key={key}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-outline-gray-2 p-3 transition-colors hover:bg-surface-gray-1 md:p-2"
                    >
                        <RadioGroupItem value={key} className="mt-0.5" />
                        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row">
                            <div className="flex flex-col items-start gap-1 sm:w-1/4">
                                <span className="text-base font-semibold leading-tight text-ink-gray-8 md:text-sm">
                                    {config.display_name}
                                </span>
                                <Badge variant="outline" theme="gray">
                                    {config.category}
                                </Badge>
                            </div>

                            <div className="flex flex-col sm:w-1/5">
                                <span className="text-base font-bold leading-relaxed text-ink-gray-8 md:text-sm">
                                    {config.pricing.split(" ")[0]}
                                </span>
                                <span className="text-p-sm leading-relaxed text-ink-gray-6">
                                    {config.pricing.split(" ").slice(1).join(" ")}
                                </span>
                            </div>

                            <div className="sm:w-2/5">
                                <p className="text-p-sm leading-relaxed text-ink-gray-6">{config.description}</p>
                            </div>

                            <div className="flex flex-col gap-1 sm:w-1/5">
                                {config.best_for.map((bestFor, index) => (
                                    <span
                                        key={index}
                                        className="flex items-center gap-2 text-p-sm leading-tight text-ink-gray-6"
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
        </div>
    )
}

export default ProcessorTypeSelector
