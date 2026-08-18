import { useFrappeGetDocList } from "frappe-react-sdk"
import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"

export type EnabledMessageAction = Pick<RavenMessageAction, "name" | "action_name">

// Stable fallback: consumers memo on the returned reference, and `data ?? []`
// would hand them a NEW empty array every render until the fetch resolves.
const NO_ACTIONS: EnabledMessageAction[] = []

/**
 * The enabled custom message actions, for the Actions submenu. Fetched once per
 * session (SWR-deduped; the key is in App.tsx's CACHE_KEYS so reloads render from
 * cache) — most sites define none, and [] is what hides the submenu entirely.
 */
export const useEnabledMessageActions = (): EnabledMessageAction[] => {
    const { data } = useFrappeGetDocList<EnabledMessageAction>(
        "Raven Message Action",
        {
            fields: ["name", "action_name"],
            filters: [["enabled", "=", 1]],
            orderBy: { field: "action_name", order: "asc" },
        },
        "message-actions-list",
        { revalidateOnFocus: false },
    )
    return data ?? NO_ACTIONS
}
