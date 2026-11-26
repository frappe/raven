import { useCallback, useSyncExternalStore } from "react"
import { wfhStore } from "@stores/leave/store"

/**
 * True if the user is working from home today. Reads the store useLeaveSync fills, subscribed
 * per user. False without HRMS or with the setting off.
 */
export function useIsUserWorkingFromHome(user: string): boolean {
    return useSyncExternalStore(
        useCallback((onChange) => wfhStore.subscribe(user, onChange), [user]),
        () => wfhStore.has(user),
    )
}
