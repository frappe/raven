import { useEffect } from "react"
import {
    // eslint-disable-next-line no-restricted-imports -- the one place that wraps it
    useForm as useHookForm,
    type FieldValues,
    type Path,
    type UseFormProps,
    type UseFormReturn,
} from "react-hook-form"

/** Errors show on submit; nothing re-checks while the user types. */
export const FORM_DEFAULTS = { reValidateMode: "onSubmit" } as const

/**
 * Clears a field's error the moment the user edits it; the next submit checks it again.
 * Only when there is one: clearErrors always notifies, re-rendering the form on every keystroke.
 */
export const clearErrorOnEdit = <T extends FieldValues>(form: Pick<UseFormReturn<T>, "subscribe" | "clearErrors" | "getFieldState">) =>
    form.subscribe({
        formState: { values: true },
        callback: ({ name, type }) => {
            if (type === "change" && name && form.getFieldState(name as Path<T>).error) form.clearErrors(name as Path<T>)
        },
    })

/**
 * react-hook-form's useForm for every app form. Its own default re-checks each keystroke
 * after a submit, so clearing a field brings up "required" before the user is done.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useForm = <T extends FieldValues = FieldValues, C = any, R = T>(props?: UseFormProps<T, C, R>) => {
    const form = useHookForm<T, C, R>({ ...FORM_DEFAULTS, ...props })
    const { subscribe, clearErrors, getFieldState } = form
    useEffect(() => clearErrorOnEdit<T>({ subscribe, clearErrors, getFieldState }), [subscribe, clearErrors, getFieldState])
    return form
}
