import { FrappeError } from "frappe-react-sdk"

interface ParsedErrorMessage {
    message: string,
    title?: string,
    indicator?: string,
}


export const getErrorMessage = (error?: FrappeError | null): string => {
    const messages = getErrorMessages(error)
    return messages.map(m => m.message).join('\n')
}

/**
 * Standard function to parse the error messages from the FrappeError object
 * @param error The FrappeError object to parse
 * @returns An array of ParsedErrorMessage objects
 */
export const getErrorMessages = (error?: FrappeError | null): ParsedErrorMessage[] => {

    // TODO: Parse Permission errors and provide a better human readable message instead of the default error message
    if (!error) return []
    let eMessages: ParsedErrorMessage[] = error?._server_messages ? JSON.parse(error?._server_messages) : []
    eMessages = eMessages.map((m) => {
        try {

            // @ts-expect-error - it can sometimes be a string
            return JSON.parse(m)

        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch (e) {
            return m
        }
    })

    // @ts-expect-error - some errors have _error_message
    if (error?._error_message) {
        eMessages.push({
            // @ts-expect-error - some errors have _error_message
            message: error?._error_message,
            title: "Error",
            indicator: "red"
        })
    }

    if (eMessages.length === 0) {
        // Get the message from the exception by removing the exc_type
        const indexOfFirstColon = error?.exception?.indexOf(':')
        if (indexOfFirstColon) {
            const exception = error?.exception?.slice(indexOfFirstColon + 1)
            if (exception) {
                eMessages = [{
                    message: exception,
                    title: "Error"
                }]
            }
        }

        if (eMessages.length === 0) {
            eMessages = [{
                message: error?.message,
                title: "Error",
                indicator: "red"
            }]
        }
    }
    return eMessages

}

export const slug = (name?: string) => {
    return name?.toLowerCase().replace(/ /g, "-") ?? "";
}

export const getSystemDefault = (fieldName: string, fallback?: string) => {
    return window.frappe?.boot?.sysdefaults?.[fieldName] ?? fallback
}

export const getUserDefault = (fieldName: string, fallback?: string) => {
    return window.frappe?.boot?.user?.defaults?.[fieldName] ?? fallback
}

export const getBootFieldData = (fieldName: string, fallback?: string) => {
    return window.frappe?.boot?.[fieldName] ?? fallback
}

export const isInReadOnlyMode = () => {
    return getBootFieldData('read_only') ?? false
}

/**
 * Frappe Cloud v2. Frappe adds `cloud_settings` to boot on a Pilot-managed site and marks it
 * enabled only for System Managers. Older Frappe has no key at all.
 */
export const isFrappeCloudV2Site = (): boolean => window.frappe?.boot?.cloud_settings?.enabled === true

/** Frappe Cloud, v1 or v2. Frappe sets both boot flags only for System Managers. */
export const isFrappeCloudSite = (): boolean => !!window.frappe?.boot?.is_fc_site || isFrappeCloudV2Site()
