import { useCallback, useSyncExternalStore } from "react"
import { leaveStore } from "@stores/leave/store"

/**
 * True if the user is on leave today. Reads the store useLeaveSync fills, subscribed per
 * user, so only that user's watchers re-render. False without HRMS or with the setting off.
 */
export function useIsUserOnLeave(user: string): boolean {
    return useSyncExternalStore(
        useCallback((onChange) => leaveStore.subscribe(user, onChange), [user]),
        () => leaveStore.has(user),
    )
}
