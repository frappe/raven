import { useFrappeGetCall } from "frappe-react-sdk"
import { hasRole } from "@lib/permissions"

export interface InstalledApp {
    name: string
    title: string
    route: string
    logo?: string
}

interface BootApp {
    app_name: string
    app_title: string
    app_route: string
    app_logo_url?: string | string[] | null
    on_apps_screen: boolean
    sequence_id?: number
}

/** Frappe 16+ boot: the apps screen's own list, permission-checked, Framework included. */
const fromBoot = (bootApps: BootApp[]): InstalledApp[] =>
    bootApps
        .filter((app) => app.on_apps_screen)
        .sort((a, b) => (a.sequence_id ?? 100) - (b.sequence_id ?? 100))
        .map((app) => ({
            name: app.app_name,
            title: app.app_title,
            route: app.app_route,
            logo: (Array.isArray(app.app_logo_url) ? app.app_logo_url[0] : app.app_logo_url) ?? undefined,
        }))

/** Frappe 15 lists no Framework entry, so add Desk at /app, for System Managers only, as 16 does. */
const withDesk = (apps: InstalledApp[]): InstalledApp[] =>
    hasRole("System Manager")
        ? [{ name: "frappe", title: "Framework", route: "/app", logo: "/assets/frappe/images/frappe-framework-logo.svg" }, ...apps]
        : apps

/**
 * Apps on the site this user can open, Raven excluded, for the app switcher.
 * Only Frappe 15 needs the request; the native app has no site pages to open, so it never fetches.
 */
export const useInstalledApps = (): InstalledApp[] => {
    const bootApps: BootApp[] | undefined = window.frappe?.boot?.app_data
    const { data } = useFrappeGetCall<{ message: InstalledApp[] }>(
        "frappe.apps.get_apps",
        undefined,
        import.meta.env.VITE_NATIVE || bootApps ? null : "installed_apps",
        { revalidateOnFocus: false, revalidateOnReconnect: false },
    )

    if (import.meta.env.VITE_NATIVE) return []
    const apps = bootApps ? fromBoot(bootApps) : withDesk(data?.message ?? [])
    return apps.filter((app) => app.name !== "raven" && app.route)
}
