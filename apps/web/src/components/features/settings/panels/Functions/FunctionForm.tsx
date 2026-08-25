import { useEffect, useState } from "react"
import { useFormState, useWatch } from "react-hook-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { SquareFunctionIcon, VariableIcon } from "lucide-react"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import DoctypeVariableBuilder from "./DoctypeVariableBuilder"
import { VARIABLE_FUNCTION_TYPES } from "./variableFieldMapping"
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
    const [tab, setTab] = useState("details")
    const { errors, submitCount } = useFormState<RavenAIFunction>({
        name: ["type", "function_name", "description", "reference_doctype", "function_path"],
    })

    // All required fields live on Details; jump there when a submit fails validation.
    useEffect(() => {
        if (!submitCount) return
        if (errors.type || errors.function_name || errors.description || errors.reference_doctype || errors.function_path) setTab("details")
    }, [submitCount]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Tabs value={tab} onValueChange={setTab}>
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
                <VariablesEmptyHint type={type} />
            </TabsContent>
        </Tabs>
    )
}

/** Shown when neither builder applies yet — explains what unlocks this tab. */
const VariablesEmptyHint = ({ type }: { type?: string }) => {
    const referenceDoctype = useWatch<RavenAIFunction>({ name: "reference_doctype" })
    const isDocRef = VARIABLE_FUNCTION_TYPES.includes(type ?? "")

    if (type === "Custom Function" || (isDocRef && referenceDoctype)) return null
    return (
        <p className="rounded-md border border-dashed border-outline-gray-2 px-3 py-6 text-center text-p-sm text-ink-gray-5">
            {isDocRef
                ? _("Select a Reference Doctype on the Details tab to define variables.")
                : _("Pick a Create/Update document type or Custom Function on the Details tab to define variables.")}
        </p>
    )
}

export default FunctionForm
