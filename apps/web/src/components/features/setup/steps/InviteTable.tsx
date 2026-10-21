import { useFieldArray, useFormContext } from "react-hook-form"
import { Check, Plus, X } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { useUserCookieData } from "@hooks/useUserCookieData"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { validateInviteEmail, validateInviteFirstName, type InviteError } from "./inviteValidation"
import type { Invitee } from "../types"

export type InviteForm = { rows: Invitee[] }
export const EMPTY_INVITE: Invitee = { email: "", first_name: "" }

/** Email | First name | row action, shared by the header and every row. */
const GRID = "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_2.25rem]"

const errorText = (error: InviteError) => {
    switch (error) {
        case "email_required":
            return _("Email is required")
        case "email_invalid":
            return _("Enter a valid email address")
        case "self":
            return _("That's you, no invite needed")
        case "duplicate":
            return _("Already on the list")
        case "first_name_required":
            return _("First name is required")
    }
}

/** A validator's result as a react-hook-form rule: true, or the message to show. */
const asRule = (error: InviteError | null) => (error ? errorText(error) : true)

/** Like a Frappe child table: one row per person; people already invited stay with a tick. */
export const InviteTable = ({ invited, label }: { invited: Invitee[]; label: string }) => {
    const { control, register, clearErrors, formState: { errors } } = useFormContext<InviteForm>()
    const { fields, append, remove, update } = useFieldArray({ control, name: "rows" })
    const { name: currentUser } = useUserCookieData()

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-p-sm-medium text-ink-gray-7">{label}</span>
            <div className="flex flex-col overflow-hidden rounded-md border border-outline-gray-2">
                <div className={cn(GRID, "border-b border-outline-gray-2 bg-surface-gray-2 text-sm-medium text-ink-gray-5")}>
                    <span className="px-3 py-1.5">{_("Email")}</span>
                    <span className="border-s border-outline-gray-2 px-3 py-1.5">{_("First name")}</span>
                    <span />
                </div>
                <ul className="max-h-72 divide-y divide-outline-gray-1 overflow-y-auto">
                    {invited.map((person) => (
                        <li key={person.email} className={cn(GRID, "h-9 items-center text-base text-ink-gray-7 md:text-sm")}>
                            <span className="truncate px-3">{person.email}</span>
                            <span className="flex h-full items-center truncate border-s border-outline-gray-1 px-3">{person.first_name}</span>
                            <span className="flex justify-center" title={_("Invited")}>
                                <Check className="size-4 text-ink-green-6" aria-label={_("Invited")} />
                            </span>
                        </li>
                    ))}
                    {fields.map((field, index) => {
                        const rowErrors = errors.rows?.[index]
                        const message = rowErrors?.email?.message ?? rowErrors?.first_name?.message
                        return (
                            <li key={field.id}>
                                <div className={cn(GRID, "items-stretch")}>
                                    <Input
                                        variant="ghost"
                                        type="email"
                                        placeholder="name@company.com"
                                        aria-label={_("Email")}
                                        aria-invalid={!!rowErrors?.email || undefined}
                                        className="focus-visible:bg-surface-gray-1"
                                        {...register(`rows.${index}.email`, {
                                            validate: (_value, values) => asRule(validateInviteEmail(values.rows[index], { rows: values.rows, invited, currentUser })),
                                        })}
                                    />
                                    <Input
                                        variant="ghost"
                                        placeholder={_("First name")}
                                        aria-label={_("First name")}
                                        aria-invalid={!!rowErrors?.first_name || undefined}
                                        // The column line is this cell's own border; it stays when the cell is focused.
                                        className="border-s border-s-outline-gray-1 focus-visible:border-s-outline-gray-1 active:border-s-outline-gray-1 focus-visible:bg-surface-gray-1"
                                        {...register(`rows.${index}.first_name`, {
                                            validate: (_value, values) => asRule(validateInviteFirstName(values.rows[index])),
                                        })}
                                    />
                                    <div className="flex items-center justify-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            isIconButton
                                            aria-label={fields.length > 1 ? _("Remove row") : _("Clear row")}
                                            onClick={() => {
                                                if (fields.length > 1) return remove(index)
                                                // The table always keeps a row; the last one empties instead.
                                                update(index, EMPTY_INVITE)
                                                clearErrors(`rows.${index}`)
                                            }}
                                        >
                                            <X />
                                        </Button>
                                    </div>
                                </div>
                                {message && <p className="px-3 pb-2 text-p-sm text-ink-red-6">{message}</p>}
                            </li>
                        )
                    })}
                </ul>
                <div className="border-t border-outline-gray-1 p-1">
                    {/* shouldFocus scrolls the new row into view and focuses its email */}
                    <Button type="button" variant="ghost" size="sm" onClick={() => append(EMPTY_INVITE, { shouldFocus: true })}>
                        <Plus />
                        {_("Add row")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
