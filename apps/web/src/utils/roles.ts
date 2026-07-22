/** Role/permission helpers, read from the Frappe boot payload. */

type BootUser = { roles?: string[] }

const bootRoles = (): string[] => {
    // @ts-expect-error — frappe boot is injected globally, not typed here
    return (window?.frappe?.boot?.user as BootUser | undefined)?.roles ?? []
}

export const hasRavenUserRole = () => {
    if (import.meta.env.DEV) return true
    return bootRoles().includes("Raven User")
}

export const hasRavenAdminRole = () => bootRoles().includes("Raven Admin")

export const isSystemManager = () => bootRoles().includes("System Manager")

export const hasServerScriptEnabled = () => {
    if (import.meta.env.DEV) return true
    // @ts-expect-error — frappe boot is injected globally, not typed here
    return Boolean(window?.frappe?.boot?.server_script_enabled)
}
