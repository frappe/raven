import { describe, expect, it, vi } from "vitest"
import { createFormControl, type UseFormRegisterReturn } from "react-hook-form"
import { FORM_DEFAULTS, clearErrorOnEdit } from "./form"

type Values = { password: string; confirm: string }

/** A form as the app builds it, with one failed submit behind it. */
const submittedForm = async () => {
    const form = createFormControl<Values>({ ...FORM_DEFAULTS, defaultValues: { password: "", confirm: "" } })
    const unsubscribe = clearErrorOnEdit(form)
    const password = form.register("password", { required: "Password is required" })
    const confirm = form.register("confirm", { required: "Confirm is required" })
    await form.handleSubmit(() => { })()
    return { form, password, confirm, unsubscribe }
}

const type = (field: UseFormRegisterReturn, value: string) =>
    field.onChange({ target: { name: field.name, value }, type: "change" })

describe("app forms", () => {
    it("show errors once submitted", async () => {
        const { form } = await submittedForm()
        expect(form.getFieldState("password").error?.message).toBe("Password is required")
    })

    it("clear a field's error as soon as it's edited, even back to empty", async () => {
        const { form, password } = await submittedForm()
        await type(password, "a")
        await type(password, "")
        expect(form.getFieldState("password").error).toBeUndefined()
    })

    it("leave the other fields' errors alone", async () => {
        const { form, password } = await submittedForm()
        await type(password, "a")
        expect(form.getFieldState("confirm").error?.message).toBe("Confirm is required")
    })

    it("don't touch form state while typing in a field with no error", async () => {
        const form = createFormControl<Values>({ ...FORM_DEFAULTS, defaultValues: { password: "", confirm: "" } })
        const clearErrors = vi.fn()
        clearErrorOnEdit({ ...form, clearErrors })
        await type(form.register("password"), "a")
        expect(clearErrors).not.toHaveBeenCalled()
    })

    it("check every field again on the next submit", async () => {
        const { form, password } = await submittedForm()
        await type(password, "")
        await form.handleSubmit(() => { })()
        expect(form.getFieldState("password").error?.message).toBe("Password is required")
    })
})
