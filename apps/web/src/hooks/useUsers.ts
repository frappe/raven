import { useMemo } from "react"
import { useUsersById } from "@hooks/useMessageRowLookups"
import type { UserData } from "@db"

/**
 * Array view of the users store, for the handful of consumers that need to map over
 * every user (filter lists, pickers) rather than look one up by id.
 *
 * Prefer this over `useLiveQuery(() => db.users.toArray())`: that runs a full-table
 * IndexedDB read per consumer on every users write, which is the pattern usersStore
 * was built to replace. Here the store keeps one shared snapshot and reuses the object
 * reference of every user whose fields did not change, so this array is rebuilt only
 * when the store's Map identity changes — and memo'd rows (avatars) keep their
 * identity across unrelated writes.
 */
export const useUsers = (): UserData[] => {
    const usersById = useUsersById()
    return useMemo(() => [...usersById.values()], [usersById])
}
