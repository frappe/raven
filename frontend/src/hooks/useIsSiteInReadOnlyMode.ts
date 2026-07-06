export const useIsSiteInReadOnlyMode = () => {

    // @ts-expect-error
    return window?.frappe?.boot?.read_only ?? false
}