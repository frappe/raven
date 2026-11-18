import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from "react"
import { flushSync } from "react-dom"
import { useFormContext } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from "@components/ui/form"
import { InputGroup, InputGroupAddon, InputGroupButton } from "@components/ui/input-group"
import { Input } from "@components/ui/input"
import type { FormElementProps } from "@components/ui/form-elements"
import { Kbd, KbdGroup } from "@components/ui/kbd"
import { KeyboardMetaKeyIcon } from "@components/ui/keyboard-keys"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { isMaskedPassword } from "@lib/password"
import _ from "@lib/translate"

interface PasswordFieldProps extends Omit<FormElementProps, "readOnly"> {
    /** On the input group, e.g. a taller field in a mobile sheet. */
    className?: string
    inputProps?: Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "name" | "ref" | "type">
}

/** A password field with a show/hide button (Mod+I), as frappe-ui's Password. */
export const PasswordField = ({ name, label, rules, isRequired, formDescription, hideLabel, disabled, className, inputProps }: PasswordFieldProps) => {
    const { control } = useFormContext()
    const [show, setShow] = useState(false)
    const toggle = () => setShow((shown) => !shown)
    const toggleLabel = show ? _("Hide password") : _("Show password")

    // Hidden again before any submit: a shown password is a text field, which the browser
    // can keep in autofill history and password managers don't offer to save.
    const inputRef = useRef<HTMLInputElement | null>(null)
    useEffect(() => {
        const form = inputRef.current?.form
        if (!form) return
        const hide = () => flushSync(() => setShow(false))
        form.addEventListener("submit", hide, true)
        return () => form.removeEventListener("submit", hide, true)
    }, [])

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
            event.preventDefault()
            toggle()
        }
        inputProps?.onKeyDown?.(event)
    }

    return <FormField
        control={control}
        disabled={disabled}
        name={name}
        rules={rules}
        render={({ field }) => (
            <FormItem className="flex flex-col">
                <FormLabel className={hideLabel ? "sr-only" : ""}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
                <InputGroup className={className}>
                    <FormControl>
                        <Input {...field} ref={(el) => { field.ref(el); inputRef.current = el }} {...inputProps} type={show ? "text" : "password"} onKeyDown={onKeyDown} />
                    </FormControl>
                    {!isMaskedPassword(field.value) && (
                        <InputGroupAddon align="inline-end">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <InputGroupButton
                                        size="icon-xs"
                                        aria-label={toggleLabel}
                                        disabled={disabled}
                                        // Keeps focus (and the caret) in the input.
                                        onPointerDown={(event) => event.preventDefault()}
                                        onClick={toggle}
                                    >
                                        {show ? <EyeOffIcon /> : <EyeIcon />}
                                    </InputGroupButton>
                                </TooltipTrigger>
                                <TooltipContent className="flex items-center gap-1.5">
                                    {toggleLabel}
                                    <KbdGroup><Kbd><KeyboardMetaKeyIcon /></Kbd><Kbd>I</Kbd></KbdGroup>
                                </TooltipContent>
                            </Tooltip>
                        </InputGroupAddon>
                    )}
                </InputGroup>
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}
