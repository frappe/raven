import { useFrappeGetCall } from "frappe-react-sdk"

/** The slice of a DocField this app reads for document-link previews. */
export type DocFieldMeta = {
    fieldname: string
    label?: string
    fieldtype: string
    /** Link target doctype / Select options, depending on fieldtype. */
    options?: string
    in_preview?: 0 | 1
    reqd?: 0 | 1
}

export type WorkflowMeta = {
    name: string
    workflow_state_field?: string
}

export type DoctypeMeta = {
    name: string
    fields: DocFieldMeta[]
    title_field?: string
    image_field?: string
    default_print_format?: string
    /** Attached by frappe.desk.form.load.getdoctype. */
    __print_formats?: { name: string }[]
    __workflow_docs?: WorkflowMeta[]
}

/**
 * Fieldtypes that carry no scalar value or are table-shaped — excluded from
 * previews. Mirror of frappe.model.no_value_fields + table_fields, so the
 * skeleton's row count matches what get_preview_data will actually return.
 */
const NO_VALUE_FIELDTYPES = new Set([
    "Section Break",
    "Column Break",
    "Tab Break",
    "HTML",
    "Button",
    "Image",
    "Fold",
    "Heading",
    "Attachment Gallery",
    "Table",
    "Table MultiSelect",
])

/**
 * DocType meta for document-link cards: preview field shapes (accurate
 * skeletons + fieldtype-aware value rendering), print formats, and workflow
 * docs — all from ONE getdoctype call.
 *
 * Meta doesn't change within a session, so the SWR cache (stable key, no
 * revalidation) makes this one request per doctype per session — every card
 * of the same doctype shares it.
 */
export const useDoctypeMeta = (doctype: string) => {
    const { data, isLoading, error } = useFrappeGetCall<{ docs: DoctypeMeta[] }>(
        "frappe.desk.form.load.getdoctype",
        { doctype },
        `doctype_meta::${doctype}`,
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
        },
    )

    return {
        // docs[0] is the DocType itself; the rest are child doctypes (table fields).
        meta: data?.docs?.[0],
        workflowDoc: data?.docs?.[0]?.__workflow_docs?.[0],
        isLoading,
        error,
    }
}

/**
 * The fields get_preview_data will select, in order — `in_preview` fields, or
 * the mandatory fields when none are marked (same fallback as the backend).
 */
export const previewFieldsOf = (meta: DoctypeMeta): DocFieldMeta[] => {
    const usable = meta.fields.filter((field) => !NO_VALUE_FIELDTYPES.has(field.fieldtype))
    const inPreview = usable.filter((field) => field.in_preview)
    return inPreview.length > 0 ? inPreview : usable.filter((field) => field.reqd)
}

/** How many label/value rows the loaded card will show (title/image/name render
 *  in the header, not as rows). Drives the skeleton's height. */
export const previewRowCountOf = (meta: DoctypeMeta): number =>
    previewFieldsOf(meta).filter(
        (field) => field.fieldname !== meta.title_field && field.fieldname !== meta.image_field && field.fieldname !== "name",
    ).length

/** get_preview_data keys rows by LABEL — join back to the field for its type.
 *  Only value-bearing fields count: a Section Break sharing a value field's
 *  label must not hijack the match. Duplicates beyond that are rare enough
 *  that first-match is fine. */
export const fieldByLabel = (meta: DoctypeMeta, label: string): DocFieldMeta | undefined =>
    meta.fields.find((field) => field.label === label && !NO_VALUE_FIELDTYPES.has(field.fieldtype))
