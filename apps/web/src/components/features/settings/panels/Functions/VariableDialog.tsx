import { useState } from "react"
import _ from "@lib/translate"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import { DialogClose } from "@components/ui/dialog"
import { FormRequiredIndicator } from "@components/ui/form"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Textarea } from "@components/ui/textarea"
import { NumberVariableType, StringVariableType, VariableType } from "./FunctionConstants"

type Props = {
    defaultValues?: VariableType
    defaultRequired?: boolean
    onAdd: (name: string, variable: Partial<VariableType>, required?: boolean) => void
    allowNameChange: boolean
    name?: string
}

type DialogVariableType = "object" | "array" | "string" | "number" | "boolean"
type ArrayItemType = StringVariableType | NumberVariableType

/** Add/Edit form for a single custom-function schema variable; local state (not react-hook-form), the parent collects values on submit. */
const VariableDialog = ({ defaultValues, onAdd, allowNameChange, name: defaultName, defaultRequired }: Props) => {
    const [type, setType] = useState<DialogVariableType>(defaultValues?.type ?? "string")
    const [name, setName] = useState(defaultName ?? "")
    const [description, setDescription] = useState(defaultValues?.description ?? "")
    const [required, setRequired] = useState<boolean>(defaultRequired ?? false)
    const [enumValues, setEnumValues] = useState<string[]>(defaultValues?.type === "string" || defaultValues?.type === "number" ? (defaultValues.enum ?? []) : [])
    const [items, setItems] = useState<ArrayItemType | undefined>(defaultValues?.type === "array" ? defaultValues.items : undefined)

    const areAllFieldsFilled = !name || !type || !description

    const onSubmit = () => {
        onAdd(name, {
            type,
            description,
            enum: enumValues.length > 0 ? enumValues : undefined,
            items: type === "array" ? items : undefined,
        }, required)
    }

    return (
        <div className="flex flex-col gap-4 pt-2">
            <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>
                                {_("Type")}
                                <FormRequiredIndicator />
                            </Label>
                            <Select value={type} onValueChange={(value) => setType(value as DialogVariableType)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={_("Select a variable type")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">{_("String")}</SelectItem>
                                    <SelectItem value="array">{_("Array")}</SelectItem>
                                    <SelectItem value="number">{_("Number")}</SelectItem>
                                    <SelectItem value="boolean">{_("Boolean")}</SelectItem>
                                    <SelectItem value="object">{_("Object")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Label>
                            <Checkbox
                                checked={required}
                                onCheckedChange={(v) => setRequired(v === true)}
                            />
                            {_("Required")}
                        </Label>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="name">
                            {_("Name")}
                            <FormRequiredIndicator />
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            value={name}
                            required
                            readOnly={!allowNameChange}
                            onChange={(e) => setName(e.target.value?.replace(/\s/g, "_"))}
                        />
                        <p className="text-sm text-ink-gray-6">{_("Variable name must be unique, and cannot have spaces.")}</p>
                    </div>
                </div>

                {type === "array" && (
                    <div className="flex w-1/2 flex-col gap-1.5">
                        <Label>
                            {_("Type of items in the array")}
                            <FormRequiredIndicator />
                        </Label>
                        <Select value={items?.type} onValueChange={(value) => setItems((v) => ({ ...v, type: value as "string" | "number" }))}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={_("Select a variable type")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="string">{_("String")}</SelectItem>
                                <SelectItem value="number">{_("Number")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="description">
                        {_("Description")}
                        <FormRequiredIndicator />
                    </Label>
                    <Textarea
                        id="description"
                        name="description"
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={_("Enter a description for this variable")}
                    />
                </div>

                {(type === "string" || type === "number") && (
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="enumValues">{_("Options")}</Label>
                        <Textarea
                            id="enumValues"
                            name="enumValues"
                            rows={7}
                            className="resize-y"
                            value={enumValues.join("\n")}
                            onChange={(e) => setEnumValues(e.target.value.split("\n"))}
                        />
                        <p className="text-sm text-ink-gray-6">{_("Add a new option on a new line.")}</p>
                        <p className="text-sm text-ink-gray-6">{_("If you want this variable to have a default value, just add one option.")}</p>
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline">{_("Close")}</Button>
                </DialogClose>
                <Button type="button" onClick={onSubmit} disabled={areAllFieldsFilled}>{_("Add")}</Button>
            </div>
        </div>
    )
}

export default VariableDialog
