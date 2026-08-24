import { useCallback, useSyncExternalStore } from "react"
import { leaveStore } from "@stores/leave/store"

/**
 * True if the user is on leave today. Store-backed: the leave set is fetched once by
 * useLeaveSync (get_all_users_on_leave) and read here as a per-user subscription, so
 * a component re-renders only when THAT user's leave state changes — no per-user API
 * call. Returns false when HRMS is absent or the setting is off (the store is empty).
 */
export function useIsUserOnLeave(user: string): boolean {
    return useSyncExternalStore(
        useCallback((onChange) => leaveStore.subscribe(user, onChange), [user]),
        () => leaveStore.isOnLeave(user),
    )
}
