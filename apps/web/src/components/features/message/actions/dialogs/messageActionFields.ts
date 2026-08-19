import _ from "@lib/translate"
import type { RavenMessageActionFields } from "@raven/types/RavenIntegrations/RavenMessageActionFields"

/** The HTML input types a Data field's `options` may select (v2 parity). */
const DATA_INPUT_TYPES = new Set([
    "number", "search", "time", "text", "hidden", "tel", "url", "email",
    "date", "datetime-local", "month", "password", "week",
])

export type FieldDescriptor =
    | { kind: "data"; inputType: string }
    | { kind: "small-text" }
    | { kind: "select"; choices: string[] }
    | { kind: "link"; doctype: string }
    | { kind: "date" }
    | { kind: "checkbox" }

/**
 * Pure mapping from a `Raven Message Action Fields` row to the form control that
 * renders it. `options` is overloaded by the doctype: the target doctype for Link,
 * newline-separated choices for Select, an HTML input type for Data.
 */
export const describeField = (field: RavenMessageActionFields): FieldDescriptor => {
    switch (field.type) {
        case "Small Text":
            return { kind: "small-text" }
        case "Select":
            return {
                kind: "select",
                choices: (field.options ?? "")
                    .split("\n")
                    .map((choice) => choice.trim())
                    .filter(Boolean),
            }
        case "Link":
            return { kind: "link", doctype: field.options?.trim() ?? "" }
        case "Date":
            return { kind: "date" }
        case "Checkbox":
            return { kind: "checkbox" }
        case "Number":
            return { kind: "data", inputType: "number" }
        case "Time":
            return { kind: "data", inputType: "time" }
        case "Datetime":
            return { kind: "data", inputType: "datetime-local" }
        default: {
            const inputType = field.options?.trim()
            return { kind: "data", inputType: inputType && DATA_INPUT_TYPES.has(inputType) ? inputType : "text" }
        }
    }
}

export const requiredRule = (field: RavenMessageActionFields): { required: string } | undefined =>
    field.is_required === 1 ? { required: _("{0} is required", [field.label]) } : undefined

/**
 * Every field starts controlled: an empty seed per defined field ("" — 0 for
 * Checkbox), with the server-resolved defaults layered on top. Without this,
 * a field the admin left default-less mounts `undefined` and React warns
 * about an uncontrolled→controlled flip on first keystroke.
 */
export const seedDefaults = (
    fields: RavenMessageActionFields[],
    serverDefaults: Record<string, unknown>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const field of fields) {
        const server = serverDefaults[field.fieldname]
        if (server === undefined || server === null || server === "") {
            out[field.fieldname] = field.type === "Checkbox" ? 0 : ""
        } else if (field.type === "Checkbox") {
            // Static/Jinja defaults arrive as strings — "0" is truthy, Number() isn't fooled.
            out[field.fieldname] = Number(server) ? 1 : 0
        } else if (field.type === "Datetime" && typeof server === "string") {
            // Frappe's "YYYY-MM-DD HH:MM:SS.ffffff" renders EMPTY in a datetime-local
            // input while still submitting — normalize to the input's own format.
            out[field.fieldname] = server.replace(" ", "T").slice(0, 16)
        } else {
            out[field.fieldname] = server
        }
    }
    // Server keys for fields not in the action's list pass through untouched.
    for (const [key, value] of Object.entries(serverDefaults)) {
        if (!(key in out)) out[key] = value
    }
    return out
}

/**
 * Coerce submitted form values into what Frappe expects: Number inputs post
 * strings, Checkbox stores 0|1, and datetime-local yields "YYYY-MM-DDTHH:MM"
 * where Frappe wants "YYYY-MM-DD HH:MM:SS". Empty values pass through untouched
 * so optional fields stay optional.
 */
export const coerceValues = (
    fields: RavenMessageActionFields[],
    values: Record<string, unknown>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...values }
    for (const field of fields) {
        const value = out[field.fieldname]
        if (value === undefined || value === null || value === "") continue
        if (field.type === "Number") out[field.fieldname] = Number(value)
        if (field.type === "Checkbox") out[field.fieldname] = value ? 1 : 0
        if (field.type === "Datetime" && typeof value === "string") {
            const normalized = value.replace("T", " ")
            out[field.fieldname] = normalized.length === 16 ? `${normalized}:00` : normalized
        }
    }
    return out
}
