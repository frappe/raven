import { useContext, useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { useSetAtom } from "jotai"
import { FrappeContext, type FrappeConfig } from "frappe-react-sdk"
import { Trash2Icon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@components/ui/popover"
import LinkFieldCombobox from "@components/common/LinkFieldComboBox/LinkFieldCombobox"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import _ from "@lib/translate"

interface FunctionFields {
    message: { type?: string; description?: string }
}

/** Functions tab of the Raven Bot editor. */
const AgentFunctionsTab = () => {
    const { control } = useFormContext<RavenBot>()
    const { fields, append, remove } = useFieldArray({ control, name: "bot_functions" })
    const { call } = useContext(FrappeContext) as FrappeConfig
    const setOpenTab = useSetAtom(settingsDialogOpenTab)

    const [selectedFunction, setSelectedFunction] = useState("")
    const [popoverOpen, setPopoverOpen] = useState(false)

    const onAdd = () => {
        if (!selectedFunction) return
        call.get("frappe.client.get_value", {
            doctype: "Raven AI Function",
            filters: { name: selectedFunction },
            fieldname: ["type", "description"],
        }).then((res) => {
            const { message } = res as FunctionFields
            //@ts-expect-error - append accepts a partial row; the rest are server-set defaults
            append({ function: selectedFunction, type: message?.type, description: message?.description })
            setSelectedFunction("")
            setPopoverOpen(false)
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <p className="text-p-sm text-ink-gray-6">
                    {_("Add functions that the bot can use to create or update documents in the system.")}
                    <br />
                    {_("Create functions in the")}{" "}
                    <button
                        type="button"
                        className="font-medium underline underline-offset-2"
                        onClick={() => setOpenTab("functions")}
                    >
                        {_("function builder")}
                    </button>{" "}
                    {_("and then add them here.")}
                </p>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" type="button">
                            {_("Add Function")}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px]" align="end" collisionPadding={16}>
                        <div className="flex flex-col gap-3">
                            <PopoverTitle>{_("Function")}</PopoverTitle>
                            <LinkFieldCombobox
                                doctype="Raven AI Function"
                                value={selectedFunction}
                                onChange={setSelectedFunction}
                                filters={[["name", "not in", fields.map((field) => field.function)]]}
                                dropdownClassName="max-w-[268px]"
                            />
                            <div className="flex justify-end">
                                <Button type="button" size="sm" onClick={onAdd} disabled={!selectedFunction}>
                                    {_("Add")}
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex flex-col gap-3">
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className="flex items-start justify-between gap-4 rounded-md border border-outline-gray-2 p-3 md:p-2"
                    >
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="text-base font-semibold hover:underline md:text-sm"
                                    onClick={() => setOpenTab("functions")}
                                >
                                    {field.function}
                                </button>
                                <Badge variant="subtle" theme="violet">
                                    {field.type}
                                </Badge>
                            </div>
                            <p className="text-base text-ink-gray-6 md:text-sm">{field.description}</p>
                        </div>
                        <Button
                            variant="ghost"
                            theme="red"
                            size="sm"
                            isIconButton
                            type="button"
                            title={_("Remove")}
                            aria-label={_("Remove")}
                            onClick={() => remove(index)}
                        >
                            <Trash2Icon />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default AgentFunctionsTab
