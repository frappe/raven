import { useState, type ReactNode } from "react"
import { useFormContext, useFormState, useWatch } from "react-hook-form"
import { useFrappeGetCall, useFrappeGetDocList } from "frappe-react-sdk"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import _ from "@lib/translate"
import { useIsMobile } from "@hooks/use-mobile"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { SwitchFormField } from "@components/ui/form-elements"
import { Label } from "@components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group"
import { Separator } from "@components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { TabsButton, TabsButtonItem } from "@components/ui/tab-buttons"
import { Textarea } from "@components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import type { RavenBotInstructionTemplate } from "@raven/types/RavenAI/RavenBotInstructionTemplate"

type Props = {
    allowUsingTemplate?: boolean
    instructionRequired?: boolean
    autoFocus?: boolean
}

interface InstructionFieldForm {
    instruction: string
    dynamic_instructions: 0 | 1
}

const variables = [
    { variable: "first_name", description: _("The first name of the user") },
    { variable: "full_name", description: _("The full name of the user") },
    { variable: "email", description: _("The email of the user") },
    { variable: "user_id", description: _("The ID of the user") },
    { variable: "company", description: _("The default company in the system") },
    { variable: "employee_id", description: _("The ID of the employee") },
    { variable: "employee_company", description: _("The company of the employee (value in Employee DocType)") },
    { variable: "department", description: _("The department of the employee") },
    { variable: "lang", description: _("The current user language") },
]

export const InstructionField = ({ allowUsingTemplate, instructionRequired, autoFocus }: Props) => {

    const { control } = useFormContext<InstructionFieldForm>()
    const isDynamic = useWatch({ control, name: "dynamic_instructions" })

    return (
        <div className="flex flex-col gap-4">
            <SwitchFormField
                name="dynamic_instructions"
                label={_("Dynamic Instructions")}
                formDescription={_("Dynamic Instructions allow you to embed Jinja tags in your instruction to the bot. Instructions would be different based on the user who is calling the bot or the data in your system as they are computed every time the bot is called.")}
            />
            {isDynamic
                ? <DynamicInstructionField allowUsingTemplate={allowUsingTemplate} instructionRequired={instructionRequired} autoFocus={autoFocus} />
                : <StaticInstructionField allowUsingTemplate={allowUsingTemplate} instructionRequired={instructionRequired} autoFocus={autoFocus} />}
        </div>
    )
}

const DynamicInstructionField = ({ allowUsingTemplate, instructionRequired, autoFocus }: Props) => {

    const [view, setView] = useState<"editor" | "preview">("editor")

    return (
        <div className="flex flex-col gap-4">
            <TabsButton value={view} size="md" onValueChange={(value) => setView(value as "editor" | "preview")} aria-label={_("Instruction view")}>
                <TabsButtonItem value="editor">{_("Editor")}</TabsButtonItem>
                <TabsButtonItem value="preview">{_("Preview")}</TabsButtonItem>
            </TabsButton>
            {view === "editor"
                ? <StaticInstructionField allowUsingTemplate={allowUsingTemplate} instructionRequired={instructionRequired} autoFocus={autoFocus} />
                : <InstructionPreview view={view} />}
            <Separator className="w-full" />
            <p className="text-p-base text-ink-gray-6">
                {_("Here are some variables you can use in your instruction. Simply copy by clicking on the variable.")}
                <br />
                {_("You can also use standard Jinja variables available in the system.")}
            </p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{_("Variable")}</TableHead>
                        <TableHead>{_("Description")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {variables.map((v) => <VariableRow key={v.variable} variable={v.variable} description={v.description} />)}
                </TableBody>
            </Table>
        </div>
    )
}

/** A table row showing a copyable Jinja variable chip and its description. */
export const VariableRow = ({ variable, description, withoutJinja = false }: { variable: string, description: ReactNode, withoutJinja?: boolean }) => {
    return (
        <TableRow>
            <TableCell className="md:text-sm"><VariableTooltip text={variable} withoutJinja={withoutJinja} /></TableCell>
            <TableCell className="md:text-sm">{description}</TableCell>
        </TableRow>
    )
}

/** A clickable variable chip that copies `{{ variable }}` and flips its tooltip to "Copied!". */
export const VariableTooltip = ({ text, withoutJinja = false }: { text: string, withoutJinja?: boolean }) => {

    const [tooltip, setTooltip] = useState("")

    const copyText = () => {
        navigator.clipboard.writeText(withoutJinja ? text : "{{ " + text + " }}")
            .then(() => {
                setTooltip(_("Copied!"))
                setTimeout(() => setTooltip(""), 1000)
            })
            .catch(() => toast.error(_("Failed to copy to clipboard")))
    }

    return (
        <Tooltip open={tooltip !== ""} onOpenChange={(open) => {
            if (open) {
                setTooltip(_("Copy to clipboard"))
                setTimeout(() => setTooltip(""), 1000)
            }
        }}>
            <TooltipTrigger asChild>
                <code role="button" tabIndex={0} onClick={copyText} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyText() } }} aria-label={_("Copy to clipboard")} className="cursor-pointer rounded bg-surface-gray-2 px-1.5 py-0.5 text-base md:text-sm">
                    {text}
                </code>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    )
}

const InstructionPreview = ({ view }: { view: "editor" | "preview" }) => {

    const { control } = useFormContext<InstructionFieldForm>()
    const instruction = useWatch({ control, name: "instruction" })
    const hasContent = !!instruction?.trim()

    // No render round-trip for a blank editor.
    const { data } = useFrappeGetCall<{ message: string }>(
        "raven.api.ai_features.get_instruction_preview",
        { instruction },
        view === "preview" && hasContent ? undefined : null
    )

    return (
        <div className="rounded-md border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
            {hasContent
                ? <p className="text-sm whitespace-pre-wrap">{data?.message}</p>
                : <p className="text-sm text-ink-gray-5">{_("Nothing to preview")}</p>}
        </div>
    )
}

const StaticInstructionField = ({ allowUsingTemplate, instructionRequired, autoFocus }: Props) => {

    const { register, control } = useFormContext<InstructionFieldForm>()
    const { errors } = useFormState({ control, name: "instruction" })
    const isMobile = useIsMobile()
    const isDynamic = useWatch({ control, name: "dynamic_instructions" })

    const placeholder = isDynamic
        ? _("You are an assistant running on an ERP. The current user's name is {{ first_name }} and the current company is {{ company }}.")
        : _("You are an assistant running on an ERP. You can answer questions about the company.")

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor="instruction">
                    {_("Instruction")}
                    {instructionRequired && <span className="text-ink-red-6" aria-hidden="true">*</span>}
                </Label>
                {allowUsingTemplate && <ImportTemplate />}
            </div>
            <Textarea
                id="instruction"
                {...register("instruction", {
                    required: instructionRequired ? _("Instruction is required") : false,
                    validate: (value) => {
                        if (!isDynamic && value?.includes("{{")) {
                            return _("You cannot include Jinja tags without enabling dynamic instructions.")
                        }
                        return true
                    }
                })}
                rows={10}
                placeholder={placeholder}
                autoFocus={autoFocus && !isMobile}
                aria-invalid={errors.instruction ? "true" : "false"}
            />
            {errors.instruction && <p className="text-sm text-ink-red-9">{String(errors.instruction.message)}</p>}
        </div>
    )
}

const ImportTemplate = () => {

    const { control, setValue, getValues } = useFormContext<InstructionFieldForm>()
    const isDynamic = useWatch({ control, name: "dynamic_instructions" })

    const { data, error } = useFrappeGetDocList<RavenBotInstructionTemplate>(
        "Raven Bot Instruction Template",
        {
            fields: ["name", "template_name", "dynamic_instructions", "instruction"],
            filters: isDynamic ? undefined : [["dynamic_instructions", "=", 0]]
        },
        undefined,
        { revalidateOnFocus: false },
    )

    const [selectedTemplate, setSelectedTemplate] = useState("")

    const onSelectTemplate = (type: "replace" | "append") => {
        const opts = { shouldDirty: true, shouldValidate: true }
        if (type === "replace") {
            setValue("instruction", selectedTemplate, opts)
        } else {
            const current = getValues("instruction")
            setValue("instruction", current ? `${current}\n${selectedTemplate}` : selectedTemplate, opts)
        }
    }

    return (
        <Popover onOpenChange={() => setSelectedTemplate("")}>
            <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm">{_("Import from Template")}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px]">
                <div className="flex flex-col gap-6">
                    {error && <ErrorBanner error={error} />}
                    <div className="flex flex-col gap-2">
                        <Label>{_("Select a template")}</Label>
                        {data && data.length === 0 && <p className="text-p-sm text-ink-gray-5">{_("No templates found")}</p>}
                        <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate} className="max-h-96 overflow-y-auto gap-2">
                            {data?.map((t) => (
                                <div key={t.name} className="flex items-center gap-2 rounded-md border border-outline-gray-2 px-3 py-2.5 md:py-1.5">
                                    <RadioGroupItem value={t.instruction} id={`template-${t.name}`} />
                                    <Label htmlFor={`template-${t.name}`} className="flex w-full cursor-pointer items-center justify-between gap-2">
                                        <span className="text-base md:text-sm">{t.template_name}</span>
                                        {t.dynamic_instructions
                                            ? <Badge theme="violet" variant="subtle"><Sparkles className="size-3" />{_("Dynamic")}</Badge>
                                            : null}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onSelectTemplate("replace")} disabled={!selectedTemplate}>{_("Replace")}</Button>
                        <Button type="button" onClick={() => onSelectTemplate("append")} disabled={!selectedTemplate}>{_("Add")}</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default InstructionField
