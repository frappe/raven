import { useEffect, useState } from "react"
import { useFormState, useWatch } from "react-hook-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { BotIcon, CodeIcon, CpuIcon, FileTextIcon, FolderIcon, SparklesIcon, SquareFunctionIcon } from "lucide-react"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import InstructionField from "../ai/InstructionField"
import AgentGeneralTab from "./AgentGeneralTab"
import AgentAITab from "./AgentAITab"
import AgentFunctionsTab from "./AgentFunctionsTab"
import AgentDocumentProcessorsTab from "./AgentDocumentProcessorsTab"
import AgentFileSourcesTab from "./AgentFileSourcesTab"
import AgentApiDocsTab from "./AgentApiDocsTab"
import _ from "@lib/translate"

/** Raven Bot form: General tab always; AI tabs gate on is_ai_bot; API Docs only in edit mode. */
const AgentForm = ({ isEdit }: { isEdit?: boolean }) => {
    const isAiBot = useWatch({ name: "is_ai_bot" })
    const [tab, setTab] = useState("general")
    const { errors, submitCount } = useFormState<RavenBot>({ name: ["bot_name", "model_provider", "model", "reasoning_effort", "instruction"] })

    // Hidden tabs stay mounted (forceMount) so their fields validate; jump to the first one with an error.
    useEffect(() => {
        if (!submitCount) return
        if (errors.bot_name) setTab("general")
        else if (errors.model_provider || errors.model || errors.reasoning_effort) setTab("ai")
        else if (errors.instruction) setTab("instructions")
    }, [submitCount]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Tabs value={tab} onValueChange={setTab}>
            {/* Scroll on a wrapper — the underline indicator hangs 1px below the list and a scroll container would clip it. */}
            <div className="max-w-full overflow-x-auto">
                <TabsList className="w-max min-w-full">
                <TabsTrigger value="general">
                    <BotIcon /> {_("General")}
                </TabsTrigger>
                {!!isAiBot && (
                    <>
                        <TabsTrigger value="ai">
                            <SparklesIcon /> {_("AI")}
                        </TabsTrigger>
                        <TabsTrigger value="instructions">
                            <FileTextIcon /> {_("Instructions")}
                        </TabsTrigger>
                        <TabsTrigger value="functions">
                            <SquareFunctionIcon /> {_("Functions")}
                        </TabsTrigger>
                        <TabsTrigger value="document-processors">
                            <CpuIcon /> {_("Document Processors")}
                        </TabsTrigger>
                        <TabsTrigger value="files">
                            <FolderIcon /> {_("Files")}
                        </TabsTrigger>
                    </>
                )}
                {isEdit && (
                    <TabsTrigger value="api-docs">
                        <CodeIcon /> {_("API Docs")}
                    </TabsTrigger>
                )}
                </TabsList>
            </div>
            <TabsContent value="general" className="pt-4">
                <AgentGeneralTab />
            </TabsContent>
            <TabsContent value="ai" forceMount className="pt-4 data-[state=inactive]:hidden">
                <AgentAITab />
            </TabsContent>
            <TabsContent value="instructions" forceMount className="pt-4 data-[state=inactive]:hidden">
                <InstructionField allowUsingTemplate instructionRequired={!!isAiBot} />
            </TabsContent>
            <TabsContent value="functions" className="pt-4">
                <AgentFunctionsTab />
            </TabsContent>
            <TabsContent value="document-processors" className="pt-4">
                <AgentDocumentProcessorsTab />
            </TabsContent>
            <TabsContent value="files" className="pt-4">
                <AgentFileSourcesTab />
            </TabsContent>
            <TabsContent value="api-docs" className="pt-4">
                <AgentApiDocsTab />
            </TabsContent>
        </Tabs>
    )
}

export default AgentForm
