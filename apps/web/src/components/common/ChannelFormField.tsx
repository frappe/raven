import { useMemo } from "react"
import { useFormContext, type RegisterOptions } from "react-hook-form"
import { FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from "@components/ui/form"
import { ChannelFilter } from "@components/common/filters/ChannelFilter"
import { useChannels } from "@stores/channels/useChannelList"
import _ from "@lib/translate"

/** The channel filter reports "nothing picked" with this sentinel. In a form that is just an empty value. */
const NONE = "*all"

/**
 * A controlled channel picker sized like a form input. Uses the same grouped, icon-bearing
 * dropdown as the search filters, over the channels the user is in (archived ones excluded).
 */
export const ChannelPicker = ({
    value, onChange, placeholder,
}: { value: string; onChange: (value: string) => void; placeholder?: string }) => {
    const { channels } = useChannels()
    const options = useMemo(() => channels.filter((c) => !c.is_archived), [channels])
    return (
        <ChannelFilter
            channels={options}
            value={value || NONE}
            onValueChange={(next) => onChange(next === NONE ? "" : next)}
            allLabel={placeholder ?? _("Select a channel")}
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

/** ChannelPicker bound to a react-hook-form field. */
export const ChannelFormField = ({ name, label, rules, isRequired, formDescription, placeholder, disabled }: Props) => {
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
                    <ChannelPicker value={field.value} onChange={field.onChange} placeholder={placeholder} />
                    {formDescription && <FormDescription>{formDescription}</FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export default ChannelFormField
