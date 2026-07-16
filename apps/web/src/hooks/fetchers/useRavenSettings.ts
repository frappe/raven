import { useFrappeGetDoc } from "frappe-react-sdk"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"

/**
 * The single Raven Settings doc — admin-facing configuration (AI, HR, push, …).
 * Ported from v2: cached 8h, no focus revalidation (it changes rarely and only
 * an admin can). Panels gate their write UI behind an admin-role check.
 */
export const useRavenSettings = () => {
    const { data, mutate, error, isLoading } = useFrappeGetDoc<RavenSettings>(
        "Raven Settings",
        "Raven Settings",
        "raven_settings",
        {
            revalidateOnFocus: false,
            dedupingInterval: 8 * 60 * 60 * 1000,
        },
    )

    return { ravenSettings: data, mutate, error, isLoading }
}
