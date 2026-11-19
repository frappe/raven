import { useMemo, useSyncExternalStore } from "react"
import { useUserCookieData } from "@hooks/useUserCookieData"
import type { ContactPayload } from "@lib/contact"
import { matchContactUser } from "@lib/contactUser"
import { usersStore } from "@stores/usersStore"

/** A contact's Raven user match; mount this only inside an open details view. */
export const useContactUser = (contact: ContactPayload | null) => {
    const users = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)
    const { name: self } = useUserCookieData()
    return useMemo(() => (contact ? matchContactUser(contact, users, self) : null), [contact, users, self])
}
