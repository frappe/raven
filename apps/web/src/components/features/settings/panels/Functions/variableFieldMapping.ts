import type { DocField } from "@raven/types/Core/DocField"
import type { DocType } from "@raven/types/Core/DocType"
import type { RavenAIFunctionParams } from "@raven/types/RavenAI/RavenAIFunctionParams"

/** Function types the variable builder applies to — create/update document functions. */
export const VARIABLE_FUNCTION_TYPES = ["Create Document", "Update Document", "Create Multiple Documents", "Update Multiple Documents"]

/** DocField types that map onto a child doctype. */
export const TABLE_FIELD_TYPES = ["Table", "Table MultiSelect"]

/** Field types that can be turned into a function variable. */
export const VALID_DOCTYPE_FIELD_TYPES: DocField["fieldtype"][] = [
    "Autocomplete",
    "Attach",
    "Attach Image",
    "Check",
    "Code",
    "Currency",
    "Data",
    "Date",
    "Datetime",
    "Float",
    "HTML Editor",
    "Markdown Editor",
    "Int",
    "JSON",
    "Select",
    "Text",
    "Text Editor",
    "Time",
    "Phone",
    "Percent",
    "Long Text",
    "Small Text",
    "Rating",
    "Link",
    "Dynamic Link"
]

export const inList = (list: string[], value: string | undefined) => list.includes(value ?? "")

/** Table/Table MultiSelect fields of a doctype meta. */
export const getTableFields = (doctypeMeta?: DocType) =>
    doctypeMeta?.fields?.filter((field) => inList(TABLE_FIELD_TYPES, field.fieldtype))

/** Fields of a doctype meta that can be turned into a function variable. */
export const getValidVariableFields = (doctypeMeta?: DocType) =>
    doctypeMeta?.fields?.filter((field) => inList(VALID_DOCTYPE_FIELD_TYPES, field.fieldtype))

/**
 * The doctype whose fields apply: the main doctype, or the child doctype of
 * the selected table field (when one is selected).
 */
export const getActiveDoctypeName = (doctypeMeta: DocType | undefined, selectedTableField: string | undefined, doctype: string) => {
    if (doctype === selectedTableField) {
        return doctype
    }

    const childDoctypeName = doctypeMeta?.fields?.find((field) => field.fieldname === selectedTableField)?.options

    if (childDoctypeName) {
        return childDoctypeName
    }

    return doctype
}

/** The doctype linked by a Link field of the given name, if any. */
export const resolveLinkDoctypeName = (doctypeMeta: DocType | undefined, fieldname: string) =>
    doctypeMeta?.fields?.find((field) => field.fieldtype === "Link" && field.fieldname === fieldname)?.options ?? ""

/** Maps a DocField onto a function variable: fieldname, description template, options, JSON type, required flag. */
export const getFieldInfoFromDocField = (field: DocField, childDoctypeName?: string) => {
    let description = field.label ?? field.fieldname ?? ""
    let options = ""
    let type: RavenAIFunctionParams["type"] = "string"

    if (field.fieldtype === "Select") {
        options = field.options ?? ""
    }

    if (inList(["Int", "Rating"], field.fieldtype)) {
        type = "integer"
    }

    if (inList(["Float", "Currency", "Percent"], field.fieldtype)) {
        type = "number"
    }

    if (field.fieldtype === "Percent") {
        description = `${field.label} in percentage (between 0 and 100)`
    }

    if (field.fieldtype === "Check") {
        type = "boolean"
    }

    if (field.fieldtype === "Date") {
        description = `${field.label} in YYYY-MM-DD format`
    }

    if (field.fieldtype === "Datetime") {
        description = `${field.label} in YYYY-MM-DD HH:mm:ss format`
    }

    if (field.fieldtype === "Time") {
        description = `${field.label} in HH:mm:ss format`
    }

    if (childDoctypeName) {
        description += ` in ${childDoctypeName}`
    }

    return {
        fieldname: field.fieldname,
        description,
        options,
        type,
        required: field.reqd,
    }
}
