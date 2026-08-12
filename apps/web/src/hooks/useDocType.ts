import { useFrappeGetCall } from "frappe-react-sdk"

// Frappe's desk injects `window.locals` (a client-side DocType meta cache) and
// `window.frappe.model`. Neither is guaranteed in the Raven SPA, so read them
// defensively — a bare `locals` reference throws ReferenceError when unset.
type FrappeWindow = Window & {
    locals?: Record<string, Record<string, unknown>>
    frappe?: { model?: { add_to_locals?: (doc: unknown) => void } }
}

export const useDocType = (doctype: string, with_parent: 0 | 1 = 1, cached_timestamp?: Date) => {
    const w = typeof window !== "undefined" ? (window as FrappeWindow) : undefined
    const localData = w?.locals?.["DocType"]?.[doctype] ?? null

    const { data, error, isLoading } = useFrappeGetCall('frappe.desk.form.load.getdoctype', {
        doctype: doctype,
        with_parent: with_parent,
        cached_timestamp: cached_timestamp ?? null,
    }, localData || !doctype ? null : undefined, {
        onSuccess: (data) => {
            const addToLocals = w?.frappe?.model?.add_to_locals
            if (data && addToLocals) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data?.docs?.forEach((d: any) => addToLocals(d))
            }
        },
        revalidateIfStale: false,
        revalidateOnFocus: false,
    })

    return {
        data: localData || (data?.docs?.[0] ?? null),
        error,
        isLoading: localData ? false : isLoading,
    }
}
