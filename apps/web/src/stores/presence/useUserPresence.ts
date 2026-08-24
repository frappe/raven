import { useCallback, useSyncExternalStore } from "react"
import { presenceStore } from "./store"

/**
 * Subscribes a component to one user's online state. Reference-stable (a boolean),
 * so the component re-renders only when THAT user goes on/offline.
 */
export const useIsUserOnline = (userID: string): boolean =>
    useSyncExternalStore(
        useCallback((onChange) => presenceStore.subscribe(userID, onChange), [userID]),
        () => presenceStore.isOnline(userID),
    )
