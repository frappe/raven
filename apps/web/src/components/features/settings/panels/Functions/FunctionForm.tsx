import { useWatch } from "react-hook-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { SquareFunctionIcon, VariableIcon } from "lucide-react"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import DoctypeVariableBuilder from "./DoctypeVariableBuilder"
import VariableBuilder from "./VariableBuilder"
import FunctionDetailsTab from "./FunctionDetailsTab"
import _ from "@lib/translate"

/** Function types that do not take variables — the Variables tab stays disabled for them. */
const NO_VARIABLES_TYPES = [
    "Get Document",
    "Get Multiple Documents",
    "Delete Document",
    "Delete Multiple Documents",
    "Attach File to Document",
    "Submit Document",
    "Cancel Document",
    "Get Amended Document",
    "Get List",
    "Get Value",
    "Set Value",
    "Get Report Result",
]

/** Form fields for a Raven AI Function: Details tab + Variables tab. */
const FunctionForm = ({ isEdit }: { isEdit?: boolean }) => {
    // useWatch stays reactive; render-time watch() freezes under React Compiler memoization.
    const type = useWatch<RavenAIFunction>({ name: "type" })

    return (
        <Tabs defaultValue="details">
            <TabsList>
                <TabsTrigger value="details">
                    <SquareFunctionIcon /> {_("Details")}
                </TabsTrigger>
                <TabsTrigger value="variables" disabled={NO_VARIABLES_TYPES.includes(type)}>
                    <VariableIcon /> {_("Variables")}
                </TabsTrigger>
            </TabsList>
            <AINotEnabledCallout />
            <TabsContent value="details" forceMount className="pt-4 data-[state=inactive]:hidden">
                <FunctionDetailsTab isEdit={isEdit} />
            </TabsContent>
            <TabsContent value="variables" className="pt-4">
                <DoctypeVariableBuilder />
                <VariableBuilder />
            </TabsContent>
        </Tabs>
    )
}

export default FunctionForm
