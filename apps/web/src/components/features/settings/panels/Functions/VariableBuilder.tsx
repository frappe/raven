import * as React from "react"
import { useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import _ from "@lib/translate"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@components/ui/dialog"
import { Switch } from "@components/ui/switch"
import { Textarea } from "@components/ui/textarea"
import { FieldTypeBadge } from "../ai/fieldTypeBadge"
import type { RavenAIFunction } from "@raven/types/RavenAI/RavenAIFunction"
import { inList } from "./variableFieldMapping"
import { ObjectVariableType, VariableType } from "./FunctionConstants"
import VariableDialog from "./VariableDialog"

class BuilderErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

/** Helps users define their Custom Function schema as raw JSON or via a visual builder (name/type/description/required/enum). */
const VariableBuilder = () => {
    const { control, getValues, setValue } = useFormContext<RavenAIFunction>()

    const type = useWatch<RavenAIFunction>({ name: "type" })

    const [viewMode, setViewMode] = useState<"json" | "builder">("builder")
    const [error, setError] = useState<string | undefined>(undefined)

    const formatJSON = () => {
        try {
            const value = getValues("params")
            const json = typeof value === "string" ? JSON.parse(value) : value

            setValue("params", JSON.stringify(json, null, 4))
        } catch (e) {
            toast.error(_("Error formatting JSON. Please check your JSON."))
            setError((e as Error).message)
        }
    }

    if (type !== "Custom Function") {
        return null
    }

    return (
        <div className="py-2">
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{_("Builder")}</span>
                        <Switch checked={viewMode === "json"} onCheckedChange={(checked) => setViewMode(checked ? "json" : "builder")} />
                        <span className="text-sm font-medium">{_("JSON")}</span>
                    </div>
                    {viewMode === "json" && (
                        <Button type="button" variant="outline" onClick={formatJSON}>{_("Format JSON")}</Button>
                    )}
                </div>
                {error && <p className="text-sm text-ink-red-9">{error}</p>}
                <Controller
                    control={control}
                    name="params"
                    render={({ field }) => {
                        if (viewMode === "builder") {
                            try {
                                const json = typeof field.value === "string" ? JSON.parse(field.value) : field.value
                                return (
                                    <BuilderErrorBoundary fallback={<p className="text-sm text-ink-red-9">{_("Error loading variables in the builder. Please check your JSON structure.")}</p>}>
                                        <VariableBuilderField json={json} onChange={(j) => field.onChange(JSON.stringify(j, null, 4))} />
                                    </BuilderErrorBoundary>
                                )
                            } catch (e) {
                                return <p className="text-sm text-ink-red-9">{_("Error loading variables in the builder. Please check your JSON structure.")}</p>
                            }
                        }
                        const value = typeof field.value === "string" ? field.value : field.value ? JSON.stringify(field.value, null, 4) : ""
                        return (
                            <Textarea
                                rows={30}
                                spellCheck={false}
                                className="resize-y bg-surface-gray-1 font-mono"
                                value={value}
                                onChange={(e) => field.onChange(e.target.value)}
                            />
                        )
                    }}
                />
            </div>
        </div>
    )
}

type EditingVariable = { name: string; properties: VariableType; required?: boolean }

const VariableBuilderField = ({ json, onChange, isNested }: { json: ObjectVariableType; onChange: (json: ObjectVariableType) => void; isNested?: boolean }) => {
    const [editingVariable, setEditingVariable] = useState<EditingVariable | undefined>(undefined)

    const properties: Record<string, VariableType> = json.properties ?? {}

    const addVariable = (name: string, newProperty: Partial<VariableType>, required?: boolean) => {
        let newRequired = json.required ?? []

        if (required && !inList(json.required ?? [], name)) {
            newRequired.push(name)
        }

        if (!required && inList(json.required ?? [], name)) {
            newRequired = newRequired.filter((n) => n !== name)
        }

        onChange({
            type: "object",
            properties: {
                ...properties,
                [name]: newProperty as VariableType
            },
            required: newRequired
        })
    }

    const removeVariable = (name: string) => {
        const newProperties = { ...properties }

        delete newProperties[name]

        const newRequired = json.required?.filter((n) => n !== name)

        onChange({
            type: "object",
            properties: newProperties,
            required: newRequired
        })
    }

    return (
        <div className="flex flex-col gap-1">
            {Object.entries(properties).length === 0 && (
                <p className="pt-4 text-center text-sm text-ink-gray-6">{_("No variables defined")}</p>
            )}
            {Object.entries(properties).map(([key, value]) => (
                <div key={key} className="rounded-md bg-surface-gray-2 p-3 shadow-sm md:p-2">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold md:text-sm">{key}</span>
                                <FieldTypeBadge type={value.type} />
                                {inList(json.required ?? [], key) && <Badge variant="subtle" theme="red">{_("Required")}</Badge>}
                            </div>
                            <p className="text-base text-ink-gray-6 md:text-sm">{value.description}</p>
                            {(value.type === "string" || value.type === "number") && value.enum && value.enum.length > 0 && (
                                <span className="text-sm font-medium text-ink-gray-6">{_("Options:")} {value.enum.join(", ")}</span>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-4 pr-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_("Edit")}
                                onClick={() => setEditingVariable({ name: key, properties: value, required: (json.required ?? []).includes(key) })}
                            >
                                <PencilIcon />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                theme="red"
                                size="sm"
                                isIconButton
                                aria-label={_("Remove")}
                                onClick={() => removeVariable(key)}
                            >
                                <Trash2Icon />
                            </Button>
                        </div>
                    </div>
                    {value.type === "object" && (
                        <div className="ml-8 mt-2 rounded-md bg-surface-base p-2">
                            <VariableBuilderField
                                isNested
                                json={value}
                                onChange={(v) => addVariable(key, v)} />
                        </div>
                    )}
                </div>
            ))}
            <div className={`flex py-3 ${isNested ? "justify-center" : "justify-start"}`}>
                <AddVariableDialog onAdd={addVariable} />
            </div>
            <EditVariableDialog
                variable={editingVariable}
                onSubmit={addVariable}
                isOpen={editingVariable !== undefined}
                onOpenChange={(v) => !v && setEditingVariable(undefined)} />
        </div>
    )
}

const AddVariableDialog = ({ onAdd }: { onAdd: (name: string, property: Partial<VariableType>, required?: boolean) => void }) => {
    const [isOpen, setIsOpen] = useState(false)

    const onSubmit = (name: string, props: Partial<VariableType>, required?: boolean) => {
        onAdd(name, props, required)
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline">{_("Add Variable")}</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{_("Add Variable")}</DialogTitle>
                <DialogDescription>{_("Add a new variable to your function schema.")}</DialogDescription>
                <VariableDialog onAdd={onSubmit} allowNameChange={true} />
            </DialogContent>
        </Dialog>
    )
}

const EditVariableDialog = ({ variable, onSubmit, isOpen, onOpenChange }: {
    variable?: EditingVariable
    onSubmit: (name: string, properties: Partial<VariableType>, required?: boolean) => void
    onOpenChange: (isOpen: boolean) => void
    isOpen: boolean
}) => {
    const onAdd = (name: string, props: Partial<VariableType>, required?: boolean) => {
        onSubmit(name, props, required)
        onOpenChange(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{_("Edit Variable")}</DialogTitle>
                <DialogDescription className="sr-only">{_("Edit the variable in your function schema.")}</DialogDescription>
                <VariableDialog
                    onAdd={onAdd}
                    allowNameChange={false}
                    defaultValues={variable?.properties}
                    defaultRequired={variable?.required}
                    name={variable?.name} />
            </DialogContent>
        </Dialog>
    )
}

export default VariableBuilder
