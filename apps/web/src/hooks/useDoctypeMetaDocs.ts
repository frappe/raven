import { useFrappeGetCall } from "frappe-react-sdk"
import type { DocType } from "@raven/types/Core/DocType"

/** DocType meta (fields + child doctypes) for the AI settings builders. */
export const useDoctypeMetaDocs = (doctype: string) => {
    const { data, isLoading, mutate } = useFrappeGetCall<{ docs: DocType[] }>(
        "frappe.desk.form.load.getdoctype",
        { doctype },
        doctype ? undefined : null,
        { dedupingInterval: 1000 * 60 * 60 * 24, revalidateOnFocus: false, revalidateOnReconnect: false },
    )
    return { doc: data?.docs?.[0], childDocs: data?.docs?.slice(1), isLoading, mutate }
}

export default useDoctypeMetaDocs
