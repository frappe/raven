import type { RavenMessageActionFields } from "@raven/types/RavenIntegrations/RavenMessageActionFields"

export type FieldData = Partial<RavenMessageActionFields>
export type ActionFieldType = RavenMessageActionFields["type"]

/** Field types offered in the builder's Type select. */
export const FIELD_TYPES: ActionFieldType[] = [
    "Data", "Number", "Select", "Link", "Checkbox", "Date", "Time", "Datetime", "Small Text",
]

/** DocType fieldtypes we can surface as an action field (drives the import + field picker). */
export const VALID_FIELD_TYPES = [
    "Data", "Small Text", "Long Text", "Select", "Link", "Autocomplete",
    "Int", "Float", "Currency", "Date", "Datetime", "Time", "Check",
]

/** Map a Frappe DocType fieldtype onto a message-action field type. */
export const toActionType = (fieldtype?: string): ActionFieldType => {
    switch (fieldtype) {
        case "Select": return "Select"
        case "Autocomplete":
        case "Link": return "Link"
        case "Int":
        case "Currency":
        case "Float": return "Number"
        case "Date": return "Date"
        case "Datetime": return "Datetime"
        case "Time": return "Time"
        case "Data": return "Data"
        case "Check": return "Checkbox"
        case "Small Text":
        case "Long Text": return "Small Text"
        default: return "Small Text"
    }
}

/** Frappe stores a Data field's validation in `options` as "Email"/"Phone"/"URL"; map to input types. */
export const dataValidationFor = (option?: string) => {
    if (option === "Email") return "email"
    if (option === "Phone") return "tel"
    if (option === "URL") return "url"
    return ""
}
