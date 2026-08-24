import { FrappeConfig, FrappeContext, useFrappeDocTypeEventListener } from "frappe-react-sdk"
import { useDebounceCallback } from "usehooks-ts"
import { UserData, db } from "@db"
import { useCallback, useContext, useEffect, useRef, useState } from "react"

/** Coalesce window for batching Raven User changes before fetching them. */
const REFRESH_DEBOUNCE_MS = 300

/**
 * Loads all users into IndexedDB and keeps them fresh. Returns true once ready.
 * Use once at the top of the app.
 *
 * Everything here is IMPERATIVE (call.get/post + Dexie writes), not
 * useFrappeGetCall — this hook lives in the app shell, and a data-returning hook
 * here re-rendered the whole shell on every user change (read in react-scan as
 * "the whole app re-rendered"). Writing to Dexie instead routes updates through
 * the usersStore liveQuery + diff, which localizes the render to the user(s) that
 * actually changed.
 *
 * On a Raven User realtime event we queue the changed name, debounce, then fetch
 * ONLY those records (not the whole list). Names we requested that don't come
 * back were deleted, so we remove them from Dexie.
 */
/** UserData fields to fetch — must match what get_list returns for the store's diff. */
const USER_FIELDS: (keyof UserData)[] = [
    "name",
    "full_name",
    "user_image",
    "first_name",
    "enabled",
    "type",
    "availability_status",
    "custom_status",
]

/**
 * The in-progress (or finished) full user load. Module-level so the fetch runs once
 * per page load no matter how many times the effect mounts — React StrictMode mounts
 * it twice in dev, which otherwise fired two get_list calls (and two clear+bulkPut,
 * briefly blanking the table). On failure we reset it so a later mount can retry.
 */
let usersInitialLoad: Promise<void> | null = null

const loadAllUsers = async (call: FrappeConfig["call"]) => {
    const res = await call.get<{ message: UserData[] }>("raven.api.raven_users.get_list")
    // Full initial load: clear first so users removed since last session drop out
    await db.users.clear()
    await db.users.bulkPut(res.message ?? [])
}

const ensureUsersLoaded = (call: FrappeConfig["call"]) => {
    if (!usersInitialLoad) {
        usersInitialLoad = loadAllUsers(call).catch((error) => {
            usersInitialLoad = null
            throw error
        })
    }
    return usersInitialLoad
}

export const useLoadUsers = () => {
    // `db` here is the Frappe DB client (getDocList), distinct from the Dexie `db` import
    const { call, db: frappeDB } = useContext(FrappeContext) as FrappeConfig
    const [isReady, setIsReady] = useState(false)
    const pending = useRef<Set<string>>(new Set())

    useEffect(() => {
        let cancelled = false

        const init = async () => {
            // Ready immediately if the users table is already populated from a prior session
            const count = await db.users.count()
            if (count > 0 && !cancelled) setIsReady(true)
            try {
                // Deduped at module level — runs the actual fetch once per page load.
                await ensureUsersLoaded(call)
            } catch (error) {
                console.error("Failed to load users", error)
            } finally {
                if (!cancelled) setIsReady(true)
            }
        }

        init()
        return () => {
            cancelled = true
        }
    }, [call])

    // Fetch the queued (changed) users and reconcile Dexie. Imperative → no shell
    // re-render; only the changed users' rows update via the usersStore diff.
    const flushChangedUsers = useCallback(async () => {
        const names = [...pending.current]
        pending.current.clear()
        if (names.length === 0) return
        try {
            const fetched = await frappeDB.getDocList<UserData>("Raven User", {
                fields: USER_FIELDS,
                filters: [["name", "in", names]],
                limit: 0,
            })
            const present = new Set(fetched.map((user) => user.name))
            const removed = names.filter((name) => !present.has(name)) // requested but gone → deleted
            if (fetched.length) await db.users.bulkPut(fetched)
            if (removed.length) await db.users.bulkDelete(removed)
        } catch (error) {
            console.error("Failed to refresh changed users", error)
        }
    }, [frappeDB])

    const debouncedFlush = useDebounceCallback(flushChangedUsers, REFRESH_DEBOUNCE_MS)

    const onUserChanged = useCallback(
        (event?: { name?: string }) => {
            if (!event?.name) return
            pending.current.add(event.name)
            debouncedFlush()
        },
        [debouncedFlush],
    )

    useFrappeDocTypeEventListener("Raven User", onUserChanged)

    return isReady
}
