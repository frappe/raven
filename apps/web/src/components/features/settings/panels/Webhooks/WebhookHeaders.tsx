import { useFieldArray, useFormContext } from "react-hook-form"
import { MinusCircleIcon, PlusIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"
import _ from "@lib/translate"

/** Headers tab — a key/value field array sent with the webhook request. */
export const WebhookHeaders = () => {
    const { register } = useFormContext<RavenWebhook>()
    const { fields, append, remove } = useFieldArray({ name: "webhook_headers" })

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <p className="text-p-sm text-ink-gray-5 max-w-lg">{_("Add the headers you want to send with the request.")}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "" })}>
                    <PlusIcon />
                    {_("Add")}
                </Button>
            </div>

            {fields.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{_("Key")} <span className="text-ink-red-3">*</span></TableHead>
                            <TableHead>{_("Value")}</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell>
                                    <Input
                                        placeholder={_("Key")}
                                        {...register(`webhook_headers.${index}.key`, { required: _("Key is required") })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input placeholder={_("Value")} {...register(`webhook_headers.${index}.value`)} />
                                </TableCell>
                                <TableCell>
                                    <Button
                                        type="button" variant="ghost" size="sm" isIconButton
                                        aria-label={_("Remove header")}
                                        onClick={() => remove(index)}
                                    >
                                        <MinusCircleIcon className="text-ink-gray-6" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}

export default WebhookHeaders
