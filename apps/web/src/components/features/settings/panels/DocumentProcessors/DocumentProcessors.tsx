import { useState } from "react"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { CircleAlertIcon, PlusIcon, Trash2Icon } from "lucide-react"
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import {
    SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Skeleton } from "@components/ui/skeleton"
import { Spinner } from "@components/ui/spinner"
import { isRavenSettingsAdmin } from "../AdminSettingsForm"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import GoogleAPINotEnabledCallout from "../ai/GoogleAPINotEnabledCallout"
import ProcessorTypeSelector from "./ProcessorTypeSelector"
import _ from "@lib/translate"

/** Shape of an entry in `raven.ai.google_ai.get_available_processor_types`. */
export interface ProcessorTypeConfig {
    type: string
    display_name: string
    description: string
    best_for: string[]
    pricing: string
    category: "digitize" | "extract" | "specialized"
}

/** Shape of an entry in `raven.ai.google_ai.get_list_of_processors`. */
export interface ExistingProcessor {
    id: string
    name: string
    display_name: string
    type: string
    processor_type_key: string
    state: string
}

/** AI → Document Processors: view existing Google processors or create a new one. */
const DocumentProcessors = () => {
    const isAdmin = isRavenSettingsAdmin()
    const [selectedProcessorType, setSelectedProcessorType] = useState("")

    // Hooks are unconditional — the non-admin gate returns after them all.
    const { ravenSettings } = useRavenSettings()
    const {
        data: existingProcessors,
        isLoading: loadingExisting,
        error: existingError,
        mutate: refetchProcessors,
    } = useFrappeGetCall<{ message: ExistingProcessor[] }>(
        "raven.ai.google_ai.get_list_of_processors",
        undefined,
        undefined,
        { revalidateOnFocus: false },
    )
    const { call: createProcessor, loading: creating } = useFrappePostCall(
        "raven.ai.google_ai.create_document_processor",
    )
    const { call: deleteProcessor, loading: deleting } = useFrappePostCall(
        "raven.ai.google_ai.delete_document_processor",
    )

    const isAIEnabled = ravenSettings?.enable_ai_integration === 1
    const hasGoogleApis = ravenSettings?.enable_google_apis === 1

    const handleCreateProcessor = () => {
        if (!selectedProcessorType || !isAdmin) return

        createProcessor({ processor_type_key: selectedProcessorType })
            .then(() => {
                refetchProcessors()
                toast.success(_("Processor created successfully"), {
                    description: _("The processor has been created and is now available to use."),
                })
                setSelectedProcessorType("")
            })
            .catch((error: Error) =>
                toast.error(_("Failed to create processor"), { description: error.message }),
            )
    }

    const handleDeleteProcessor = (processorId: string, processorName: string) =>
        deleteProcessor({ processor_id: processorId }).then(() => {
            refetchProcessors()
            toast.success(_("Processor deleted successfully"), {
                description: _("{0} has been deleted from your Google Cloud project.", [processorName]),
            })
        }).catch((error: Error) =>
            toast.error(_("Failed to delete processor"), { description: error.message }),
        )

    if (!isAdmin) {
        return (
            <>
                <SettingsPanelHeader>
                    <SettingsPanelTitle>{_("Document Processors")}</SettingsPanelTitle>
                    <SettingsPanelDescription>
                        {_("View your active document processors or select a processor type and create a new processor.")}
                    </SettingsPanelDescription>
                </SettingsPanelHeader>
                <SettingsPanelContent className="gap-4">
                    <Alert theme="amber">
                        <CircleAlertIcon />
                        <AlertDescription>{_("You need Raven Admin permissions to manage document processors.")}</AlertDescription>
                    </Alert>
                </SettingsPanelContent>
            </>
        )
    }

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button
                        size="sm"
                        onClick={handleCreateProcessor}
                        disabled={!selectedProcessorType || creating}
                    >
                        {creating ? <Spinner /> : <PlusIcon />}
                        {_("Create Processor")}
                    </Button>
                }
            >
                <SettingsPanelTitle>{_("Document Processors")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("View your active document processors or select a processor type and create a new processor.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4">
                <AINotEnabledCallout />
                <GoogleAPINotEnabledCallout />
                {isAIEnabled && hasGoogleApis && (
                    <div className="flex flex-col gap-6">
                        <ExistingProcessorsList
                            processors={existingProcessors?.message ?? []}
                            isLoading={loadingExisting}
                            error={existingError}
                            isDeleting={deleting}
                            onDeleteProcessor={handleDeleteProcessor}
                        />
                        <ProcessorTypeSelector
                            selectedProcessorType={selectedProcessorType}
                            setSelectedProcessorType={setSelectedProcessorType}
                        />
                    </div>
                )}
            </SettingsPanelContent>
        </>
    )
}

/** Grid of existing processors with delete confirmation. */
const ExistingProcessorsList = ({
    processors,
    isLoading,
    error,
    isDeleting,
    onDeleteProcessor,
}: {
    processors: ExistingProcessor[]
    isLoading: boolean
    error: { message: string } | null | undefined
    isDeleting: boolean
    onDeleteProcessor: (processorId: string, processorName: string) => Promise<unknown>
}) => {
    const [processorToDelete, setProcessorToDelete] = useState<ExistingProcessor | null>(null)

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        )
    }

    if (error) {
        return (
            <Alert theme="red">
                <CircleAlertIcon />
                <AlertDescription>{_("Error loading processors: {0}", [error.message])}</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <h5 className="text-base font-medium">{_("Active Processors ({0})", [String(processors.length)])}</h5>
            {processors.length === 0 ? (
                <p className="text-p-sm text-ink-gray-6">
                    {_("No processors created yet. Select a type below to create your first processor.")}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {processors.map((processor) => (
                            <div key={processor.id} className="flex flex-col gap-2 rounded-md border border-outline-gray-2 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-p-base font-semibold text-ink-gray-8">
                                        {processor.display_name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        theme="red"
                                        size="sm"
                                        isIconButton
                                        aria-label={_("Delete Processor")}
                                        onClick={() => setProcessorToDelete(processor)}
                                        disabled={isDeleting}
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </div>
                                <span className="truncate text-p-sm text-ink-gray-6">{processor.type}</span>
                                <Badge
                                    variant="subtle"
                                    theme={processor.state ? "green" : "red"}
                                    className="self-start"
                                >
                                    {processor.state ? _("Active") : _("Inactive")}
                                </Badge>
                            </div>
                        ))}
                    </div>

                    <AlertDialog
                        open={!!processorToDelete}
                        onOpenChange={(open) => !open && setProcessorToDelete(null)}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{_("Delete Processor")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {_("Are you sure you want to delete")} <strong>{processorToDelete?.display_name}</strong>?
                                    <br />
                                    <span className="text-p-sm text-ink-gray-6">
                                        {_("This will permanently remove the processor from your Google Cloud project. Any agents currently using this document processor will no longer be able to use it.")}
                                    </span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>{_("Cancel")}</AlertDialogCancel>
                                <Button
                                    variant="solid"
                                    theme="red"
                                    disabled={isDeleting}
                                    onClick={() => {
                                        if (!processorToDelete) return
                                        onDeleteProcessor(processorToDelete.id, processorToDelete.display_name).then(
                                            () => setProcessorToDelete(null),
                                        )
                                    }}
                                >
                                    {isDeleting && <Spinner />}
                                    {_("Delete Processor")}
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    )
}

export { DocumentProcessors }
export default DocumentProcessors
