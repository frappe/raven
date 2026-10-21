import { useMemo } from "react"
import { useFormContext, type RegisterOptions } from "react-hook-form"
import { FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from "@components/ui/form"
import { UserFilter } from "@components/common/filters/UserFilter"
import { useUsers } from "@hooks/useUsers"
import _ from "@lib/translate"

/** The user filter reports "nothing picked" with this sentinel. In a form that is just an empty value. */
const NONE = "all"

/**
 * A controlled user picker sized like a form input. Uses the same searchable, avatar-bearing
 * dropdown as the search filters, over enabled human users (bots excluded).
 */
export const UserPicker = ({
    value, onChange, placeholder,
}: { value: string; onChange: (value: string) => void; placeholder?: string }) => {
    const allUsers = useUsers()
    const users = useMemo(() => allUsers.filter((u) => u.type === "User" && u.enabled), [allUsers])
    return (
        <UserFilter
            users={users}
            value={value || NONE}
            onValueChange={(next) => onChange(next === NONE ? "" : next)}
            placeholder={placeholder ?? _("Select a user")}
            className="w-full"
            triggerClassName="h-8 w-full"
            // Forms live in the settings dialog, whose scroll lock would freeze a non-modal list.
            modal
        />
    )
}

type Props = {
    name: string
    label: string
    rules?: Omit<RegisterOptions, "disabled" | "valueAsNumber" | "valueAsDate" | "setValueAs">
    isRequired?: boolean
    formDescription?: React.ReactNode
    placeholder?: string
    disabled?: boolean
}

/** UserPicker bound to a react-hook-form field. */
export const UserFormField = ({ name, label, rules, isRequired, formDescription, placeholder, disabled }: Props) => {
    const { control } = useFormContext()
    return (
        <FormField
            control={control}
            name={name}
            rules={rules}
            disabled={disabled}
            render={({ field }) => (
                <FormItem className="min-w-0">
                    <FormLabel>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
                    <UserPicker value={field.value} onChange={field.onChange} placeholder={placeholder} />
                    {formDescription && <FormDescription>{formDescription}</FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export default UserFormField
