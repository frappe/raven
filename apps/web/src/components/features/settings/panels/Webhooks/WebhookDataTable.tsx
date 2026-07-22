import { useMemo, useState } from "react"
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { EyeIcon, InfoIcon, MinusCircleIcon, PlusIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Badge } from "@components/ui/badge"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import { Label } from "@components/ui/label"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"
import { DoctypeFieldList, SampleData, type FieldsData } from "./utils"

/** Data tab — select which document fields make up the webhook payload. */
export const WebhookData = () => {
    const { control } = useFormContext<RavenWebhook>()
    const { fields, append, remove } = useFieldArray({ name: "webhook_data" })
    const webhookTrigger = useWatch({ control, name: "webhook_trigger" })

    // The payload fields come from the selected Trigger Event — without one there's
    // nothing to pick, so gate the whole tab on it.
    const hasTrigger = Boolean(webhookTrigger)
    const availableFields = useMemo<FieldsData[]>(
        () => DoctypeFieldList.find((f) => f.events.includes(webhookTrigger))?.fields ?? [],
        [webhookTrigger],
    )

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                    <h4 className="text-base-medium text-ink-gray-8">{_("Webhook Data")}</h4>
                    <p className="text-p-sm text-ink-gray-5">{_("Select the fields you want in the webhook payload.")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <PreviewDialog />
                    <Button
                        type="button" variant="outline" size="sm"
                        disabled={!hasTrigger}
                        onClick={() => append({ fieldname: "", key: "" })}
                    >
                        <PlusIcon />
                        {_("Add")}
                    </Button>
                </div>
            </div>

            {!hasTrigger && (
                <div className="rounded-md border border-dashed border-outline-gray-2 px-4 py-6 text-center">
                    <p className="text-p-sm text-ink-gray-5">
                        {_("Select a Trigger Event in the General tab to choose payload fields.")}
                    </p>
                </div>
            )}

            {hasTrigger && fields.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{_("Fieldname")} <span className="text-ink-red-3">*</span></TableHead>
                            <TableHead>{_("Key")}</TableHead>
                            <TableHead className="w-12" />
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <WebhookDataRow
                                key={field.id}
                                index={index}
                                availableFields={availableFields}
                                trigger={webhookTrigger}
                                onRemove={() => remove(index)}
                            />
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}

/** One payload-field row. Reads its own fieldname via useWatch so the Key, the
 *  info button's enabled state and the info lookup all stay reactive. */
const WebhookDataRow = ({
    index, availableFields, trigger, onRemove,
}: {
    index: number
    availableFields: FieldsData[]
    trigger: string
    onRemove: () => void
}) => {
    const { control, register, setValue } = useFormContext<RavenWebhook>()
    const fieldname = useWatch({ control, name: `webhook_data.${index}.fieldname` })

    return (
        <TableRow>
            <TableCell>
                <Controller
                    control={control}
                    name={`webhook_data.${index}.fieldname`}
                    rules={{ required: _("Fieldname is required") }}
                    render={({ field: f }) => (
                        <Select
                            value={f.value}
                            onValueChange={(v) => { f.onChange(v); setValue(`webhook_data.${index}.key`, v) }}
                        >
                            <SelectTrigger className="w-full"><SelectValue placeholder={_("Fieldname")} /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>{_("Fieldname")}</SelectLabel>
                                    {availableFields.map((af) => (
                                        <SelectItem key={af.fieldname} value={af.fieldname}>
                                            {`${af.label} (${af.fieldtype})`}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    )}
                />
            </TableCell>
            <TableCell>
                <Input readOnly placeholder={_("Key")} {...register(`webhook_data.${index}.key`)} />
            </TableCell>
            <TableCell>
                <FieldInfoDialog fieldname={fieldname} trigger={trigger} />
            </TableCell>
            <TableCell>
                <Button
                    type="button" variant="ghost" size="sm" isIconButton
                    aria-label={_("Remove field")}
                    onClick={onRemove}
                >
                    <MinusCircleIcon className="text-ink-gray-6" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

const FieldInfoDialog = ({ fieldname, trigger }: { fieldname?: string; trigger: string }) => {
    const fieldData = useMemo(
        () => DoctypeFieldList.find((f) => f.events.includes(trigger))?.fields.find((f) => f.fieldname === fieldname),
        [fieldname, trigger],
    )

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" isIconButton disabled={!fieldname} aria-label={_("Field info")}>
                    <InfoIcon className="text-ink-gray-6" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {fieldData?.label}
                        {fieldData?.fieldtype && <Badge variant="subtle">{fieldData.fieldtype}</Badge>}
                    </DialogTitle>
                    {fieldData?.description && <DialogDescription>{fieldData.description}</DialogDescription>}
                </DialogHeader>
                {fieldData?.example !== undefined && (
                    <div className="flex flex-col gap-1.5">
                        <Label>{_("Example")}</Label>
                        <pre className="rounded-md bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7 overflow-auto max-h-64">
                            <code>{JSON.stringify(fieldData.example, null, 2)}</code>
                        </pre>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

const PreviewDialog = () => {
    const { control } = useFormContext<RavenWebhook>()
    const webhookTrigger = useWatch({ control, name: "webhook_trigger" })
    const webhookData = useWatch({ control, name: "webhook_data" })
    const [example, setExample] = useState("")

    const exampleList = useMemo(
        () => SampleData.find((s) => s.trigger_event.includes(webhookTrigger))?.examples?.map((e) => e.name) ?? [],
        [webhookTrigger],
    )

    const jsonData = useMemo(() => {
        const ex = SampleData.find((s) => s.trigger_event.includes(webhookTrigger))?.examples?.find((e) => e.name === example)
        const keys = webhookData?.map((d) => d.key)
        const obj: Record<string, unknown> = {}
        if (ex) keys?.forEach((k) => { obj[k as string] = ex.fields?.find((f) => f.field === k)?.value })
        return JSON.stringify(obj, null, 2)
    }, [example, webhookData, webhookTrigger])

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={!webhookData || webhookData.length === 0}>
                    <EyeIcon />
                    {_("Preview")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{_("Preview")}</DialogTitle>
                    <DialogDescription>{_("Preview the webhook payload for the selected example.")}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-1.5 max-w-xs">
                    <Label>{_("Example")}</Label>
                    <Select value={example} onValueChange={setExample}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={_("Select example")} /></SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>{_("Examples")}</SelectLabel>
                                {exampleList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>{_("Response Data")}</Label>
                    <pre className="rounded-md bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7 overflow-auto max-h-72 whitespace-pre-wrap">
                        <code>{jsonData}</code>
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default WebhookData
