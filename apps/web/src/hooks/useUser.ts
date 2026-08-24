import { useCallback, useSyncExternalStore } from "react"
import { usersStore } from "@stores/usersStore"
import type { UserData } from "@db"

const noopSubscribe = () => () => {}

/**
 * Reactive, per-user view of a cached user, backed by the shared usersStore.
 * Subscribes to just this user, so the component re-renders only when THIS user's
 * profile changes (the reference is otherwise stable). Returns undefined for an
 * absent / empty id.
 *
 * Replaces the old SWR-over-Dexie version, which read once with revalidation
 * disabled and so never reflected later profile updates.
 */
export const useUser = (userID?: string): UserData | undefined => {
    const subscribe = useCallback(
        (onChange: () => void) => (userID ? usersStore.subscribeUser(userID, onChange) : noopSubscribe()),
        [userID],
    )
    return useSyncExternalStore(subscribe, () => (userID ? usersStore.getUser(userID) : undefined))
}
