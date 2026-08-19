import { useFrappeGetCall } from "frappe-react-sdk"
import type { DocType } from "@raven/types/Core/DocType"

/**
 * Fetches a DocType's metadata (its field list + linked child doctypes) via
 * Frappe's form-load endpoint. Cached hard (24h) — meta rarely changes within a
 * session. Shared by settings panels that map onto a target DocType's fields
 * (Message Actions field import, Document Previews, Document Notifications).
 */
const useDoctypeMeta = (doctype: string) => {
    const { data, isLoading, mutate } = useFrappeGetCall<{ docs: DocType[] }>(
        "frappe.desk.form.load.getdoctype",
        { doctype },
        doctype ? undefined : null,
        {
            dedupingInterval: 1000 * 60 * 60 * 24,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        },
    )

    return {
        doc: data?.docs?.[0],
        childDocs: data?.docs?.slice(1),
        isLoading,
        mutate,
    }
}

export default useDoctypeMeta
