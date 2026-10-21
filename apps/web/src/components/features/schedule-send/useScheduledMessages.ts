import { useEffect, useMemo, useRef } from "react"
import { atom, useAtomValue } from "jotai"
import { useFrappeEventListener, useFrappeGetCall, useSWRConfig } from "frappe-react-sdk"
import type { ScheduledMessageRow } from "./ScheduledMessagesList"

/** SWR key prefix for everything scheduled. One prefix mutate after a user action
 *  refreshes the list, and with it the badge and the composer banners. */
export const SCHEDULED_MESSAGES_KEY = "scheduled-messages"
export const SCHEDULED_MESSAGES_LIST_KEY = `${SCHEDULED_MESSAGES_KEY}-list`

/** Whether the desktop scheduled messages dialog is open. Shared so the sidebar
 *  button and the composer banner open the same dialog. */
export const scheduledMessagesDialogOpenAtom = atom(false)

/** The row being edited inline, or null. Shared so the realtime listener can hold
 *  refetches while an edit is in progress: a refetch-driven reflow would unmount
 *  the editor and lose the unsaved text. */
export const scheduledMessageEditingAtom = atom<string | null>(null)

/**
 * The one socket subscriber for `raven_scheduled_message_updated`, mounted once in
 * AppListeners. The event carries no payload and is user-targeted, so it refetches
 * the list. While a row is being edited the refetch waits, and runs once the edit ends.
 */
export const useScheduledMessagesRealtime = () => {
    const { mutate: globalMutate } = useSWRConfig()
    const editing = useAtomValue(scheduledMessageEditingAtom)
    // The socket handler is registered once, so it reads the latest value through a ref.
    const editingRef = useRef(editing)
    editingRef.current = editing
    const pendingRef = useRef(false)

    useFrappeEventListener("raven_scheduled_message_updated", () => {
        if (editingRef.current !== null) {
            pendingRef.current = true
            return
        }
        globalMutate(SCHEDULED_MESSAGES_LIST_KEY)
    })

    // Flush a refetch that arrived mid-edit once editing ends.
    useEffect(() => {
        if (editing === null && pendingRef.current) {
            pendingRef.current = false
            globalMutate(SCHEDULED_MESSAGES_LIST_KEY)
        }
    }, [editing, globalMutate])
}

/**
 * The session user's pending (Scheduled + Failed) rows, oldest delivery first. One
 * fetch shared by the sidebar badge, the composer banners and the list: the set is
 * small, and one request beats one per channel visited. SWR dedupes the callers.
 */
export const useScheduledMessages = () => {
    const { data, error, isLoading } = useFrappeGetCall<{ message: ScheduledMessageRow[] }>(
        "raven.api.scheduled_message.get_scheduled_messages",
        undefined,
        SCHEDULED_MESSAGES_LIST_KEY,
    )
    return { rows: data?.message ?? [], error, isLoading }
}

/** Number of pending rows — drives the sidebar badge. */
export const useScheduledMessagesCount = () => useScheduledMessages().rows.length

/** The pending rows for one channel — drives the composer banner. */
export const useChannelScheduledMessages = (channelID: string) => {
    const { rows } = useScheduledMessages()
    return useMemo(() => rows.filter((row) => row.channel_id === channelID), [rows, channelID])
}
